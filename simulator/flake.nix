{
  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    bun2nix.url = "github:baileyluTCD/bun2nix";
  };

  outputs = inputs:
    inputs.flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = (import (inputs.nixpkgs) { inherit system; });
            in rec {
        bun2nix = inputs.bun2nix;
        devShells.default = pkgs.mkShell {
          buildInputs = [
              pkgs.bun
            pkgs.nodejs_24
            pkgs.nodePackages.typescript-language-server
            pkgs.nodePackages.eslint
            pkgs.nodePackages.typescript
            pkgs.pnpm_10
            packages.my-husky
            # Add the bun2nix binary to our devshell
            bun2nix.packages.${system}.default
          ];

          shellHook = ''
            echo "Frontend development shell"
            echo "Run 'bun install' to install dependencies"
          '';
        };

        packages.my-husky = pkgs.writeShellScriptBin "husky" ''
          echo "Dummy Husky"
        '';

        packages.simulator-bun = pkgs.callPackage ./. {
          inherit (bun2nix.lib.${system}) mkBunDerivation;
          inherit pkgs;
        };

        packages.default = packages.simulator;
        packages.simulator-node = pkgs.buildNpmPackage {
          pname = "openfront-simulator";
          version = "0.1.0";
          buildInputs = [
            pkgs.nodejs_24
            packages.my-husky
          ];

          src = ./.;
          npmDeps = pkgs.importNpmLock {
            npmRoot = ./.;
          };
          npmConfigHook = pkgs.importNpmLock.npmConfigHook;

          installPhase = ''
            mkdir -p $out
            cp -r src/* $out/
          '';
        };

        packages.simulator = pkgs.stdenv.mkDerivation (finalAttrs: {
          pname = "openfront-simulator";
          src = ./.;
          version = "0.1.0";
          buildInputs = [
            pkgs.nodejs_24
            pkgs.pnpm_10
            packages.my-husky
          ];
          nativeBuildInputs = [
            #pkgs.makeWrapper
            pkgs.pnpm_10.configHook
          ];
          pnpmDeps = pkgs.pnpm_10.fetchDeps {
            inherit (finalAttrs) pname version src;
            hash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
          };


          #installPhase = ''
            #mkdir -p $out/bin
            #cp ${packages.simulator-node}/bin/openfront-simulator $out/bin/openfront-simulator
            #wrapProgram $out/bin/openfront-simulator \
              #--set RUST_LOG info
          #'';
        });
      }
    );
}
