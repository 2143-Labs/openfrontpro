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
        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.nodejs
            pkgs.nodePackages.eslint
            pkgs.nodePackages.typescript-language-server
            pkgs.nodePackages.typescript

          ];

          shellHook = ''
            echo "Frontend development shell"
            echo "Run 'npm install' to install dependencies"
          '';
        };

        # packages.frontend-node = TODO: Add nix script to build frontend with node. 

        packages.default = packages.frontend-node;
      }
    );
}
