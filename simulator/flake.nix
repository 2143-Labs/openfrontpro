{
  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    bun2nix.url = "github:baileyluTCD/bun2nix";
    openfrontio_a221fee = {
        #commit = "a221fee92146caaefdee8a287e341a18da11716b";
        url = "github:OpenFrontIO/OpenFrontIO/a221fee92146caaefdee8a287e341a18da11716b";
        flake = false;
    };
  };

  outputs = { nixpkgs, bun2nix, openfrontio_a221fee, flake-utils, ... } @ inputs:
    inputs.flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = (import (nixpkgs) { inherit system; });
            in rec {
        bun2nix = inputs.bun2nix;
        devShells.default = pkgs.mkShell {
          buildInputs = [
              pkgs.bun
            pkgs.nodejs_24
            pkgs.nodePackages.typescript-language-server
            pkgs.nodePackages.eslint
            pkgs.nodePackages.typescript
            #packages.my-husky
            # Add the bun2nix binary to our devshell
            bun2nix.packages.${system}.default
          ];

          shellHook = ''
            echo "Frontend development shell"
          '';
        };

        # TODO Switch to bun when it is more stable
        packages.simulator-bun = pkgs.callPackage ./. {
          inherit (bun2nix.lib.${system}) mkBunDerivation;
          inherit pkgs;
        };

        # we need to combine the flake input openfrontio_a221fee with the simulator package
        packages.simulator-base = pkgs.stdenv.mkDerivation {
          pname = "openfront-simulator-base";
          version = "0.1.0";
          src = ./.;
          buildInputs = [
            pkgs.nodejs_24
            pkgs.jq
          ];

          installPhase = ''
            mkdir -p $out/OpenFrontIO/
            cp -r ${openfrontio_a221fee}/* $out/OpenFrontIO/
            cp -r * $out/
            jq 'del(.scripts.prepare)' $out/OpenFrontIO/package.json > $out/OpenFrontIO/package.json.tmp
            mv $out/OpenFrontIO/package.json.tmp $out/OpenFrontIO/package.json
          '';
          #ln -s ${packages.my-husky}/bin/husky $out/bin/husky
        };

        packages.default = packages.simulator-node;
        packages.simulator-node = pkgs.buildNpmPackage {
          pname = "openfronter-sim";
          version = "0.1.0";
          buildInputs = [
            pkgs.nodejs_24
            packages.simulator-base
          ];

          # We also need to include submodules here:
          src = packages.simulator-base;
          npmDeps = pkgs.importNpmLock {
            npmRoot = packages.simulator-base;
          };
            npmConfigHook = pkgs.importNpmLock.npmConfigHook;
            dontNpmPrune = true;
          nodejs = pkgs.nodejs_24;  # ensures proper shebang patching
          installPhase = ''
            runHook preInstall

            mkdir -p $out/bin/
            mkdir -p $out/src/
            cp -r src/* $out/src/
            cp ./package.json $out/
            cp -r ./node_modules/ $out/node_modules/

            cat > $out/bin/openfronter-sim <<EOF
            #!/bin/sh
            ${pkgs.nodejs_24}/bin/npm start
            EOF
            chmod +x $out/bin/openfronter-sim

            runHook postInstall
            '';
        };
        }
    );
}
