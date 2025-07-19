{
  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = inputs:
    inputs.flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = (import (inputs.nixpkgs) { inherit system; });
      in rec {
        devShell = pkgs.mkShell {
          buildInputs = [
            pkgs.nodejs_24
            pkgs.nodePackages.pnpm
            pkgs.vite
            pkgs.nodePackages.typescript
            pkgs.nodePackages.typescript-language-server
            pkgs.nodePackages.eslint
          ];
        };

        defaultPackage = packages.frontend;
        packages.frontend = pkgs.stdenv.mkDerivation {
            pname = "openfront-frontend";
            version = "0.1.0";
            src = ./.;

            buildInputs = with pkgs; [
              nodejs_24
              nodePackages.pnpm
              pkgs.vite
            ];

            buildPhase = ''
              export HOME=$TMPDIR
              pnpm config set store-dir $TMPDIR/.pnpm-store
              pnpm install
              pnpm run build
            '';

            installPhase = ''
              mkdir -p $out
              cp -r dist/* $out/
            '';
        };
      }
    );
}
