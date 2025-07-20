{
  inputs = {
    naersk.url = "github:nix-community/naersk/master";
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    utils.url = "github:numtide/flake-utils";
    frontend = {
      url = "path:../frontend";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, utils, naersk, frontend }:
    utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        naersk-lib = pkgs.callPackage naersk { };
      in
      rec {
        packages.default = packages.bundle;

        devShell = with pkgs; mkShell {
          buildInputs = [ cargo rustc rustfmt pre-commit rustPackages.clippy rust-analyzer sqlx-cli bacon];
          RUST_SRC_PATH = rustPlatform.rustLibSrc;
        };

        packages.openfrontpro = naersk-lib.buildPackage {
          src = ./.;
          pname = "openfrontpro-rs";
        };

        # This exists to act like the docker image, except only as a nix executable.
        # It only has two inputs, packages.openfrontpro and packages.openfront-frontend.
        packages.bundle = pkgs.stdenv.mkDerivation {
          name = "openfrontpro-bundle";
            inherit (packages.openfrontpro) version src;
            buildInputs = [
                packages.openfrontpro
                frontend.outputs.packages.${system}.default
                pkgs.cacert
                pkgs.bashInteractive
                pkgs.coreutils
                pkgs.curl
            ];
            nativeBuildInputs = [ pkgs.makeWrapper ];
            installPhase = ''
              mkdir -p $out/bin
              cp ${packages.openfrontpro}/bin/openfrontpro $out/bin/
              wrapProgram $out/bin/openfrontpro \
                --set FRONTEND_FOLDER ${frontend.outputs.packages.${system}.default} \
                --set RUST_LOG info
            '';
        };
      }
    );
}
