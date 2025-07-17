{
  inputs = {
    naersk.url = "github:nix-community/naersk/master";
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, utils, naersk }:
    utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        naersk-lib = pkgs.callPackage naersk { };
      in
      rec {
        defaultPackage = packages.openfrontpro;
        devShell = with pkgs; mkShell {
          buildInputs = [ cargo rustc rustfmt pre-commit rustPackages.clippy rust-analyzer sqlx-cli bacon];
          RUST_SRC_PATH = rustPlatform.rustLibSrc;
        };

        packages.openfrontpro = naersk-lib.buildPackage {
          src = ./.;
          pname = "openfrontpro";
        };

        packages.openfront-frontend = pkgs.stdenv.mkDerivation {
          pname = "openfront-frontend";
          version = "0.1.0";
          src = ./.;
          buildInputs = [  ];
          installPhase = ''
            mkdir -p $out/frontend
            cp -r frontend/* $out/frontend
          '';
        };

        packages.container = pkgs.dockerTools.buildLayeredImage {
          name = "openfrontpro";
          contents = [
            packages.openfrontpro
            packages.openfront-frontend
            pkgs.cacert
            pkgs.bashInteractive
            pkgs.coreutils
            pkgs.curl
            #pkgs.glibcLocales
            #pkgs.openssl
            #pkgs.zlib
          ];

          config = {
            ExposedPorts = { "3000/tcp" = { }; };
            EntryPoint = [ "${packages.openfrontpro}/bin/openfrontpro" ];
            Env = [
              "RUST_LOG=info"
              "FRONTEND_FOLDER=${packages.openfront-frontend}/frontend"
            ];
            #Cmd = [ "openfrontpro" ];
          };
        };
      }
    );
}
