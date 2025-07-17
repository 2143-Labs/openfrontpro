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
        defaultPackage = naersk-lib.buildPackage ./.;
        devShell = with pkgs; mkShell {
          buildInputs = [ cargo rustc rustfmt pre-commit rustPackages.clippy rust-analyzer sqlx-cli bacon];
          RUST_SRC_PATH = rustPlatform.rustLibSrc;
        };

        packages.openfrontpro = naersk-lib.buildPackage {
          src = ./.;
          pname = "openfrontpro";
        };

        packages.container = pkgs.dockerTools.buildLayeredImage {
          name = "openfrontpro";
          contents = [
            packages.openfrontpro
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
            #Cmd = [ "openfrontpro" ];
          };
        };
      }
    );
}
