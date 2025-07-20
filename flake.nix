{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    utils.url = "github:numtide/flake-utils";

    frontend = {
      url = "path:./frontend";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    rust = {
      url = "path:./rust";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    simulator = {
      url = "path:./simulator";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, utils, frontend, rust, simulator }:
    utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      rec {
        packages.default = packages.container;

        packages.container = pkgs.dockerTools.buildLayeredImage {
          name = "openfrontpro";
          contents = [
            frontend.outputs.packages.${system}.default
            rust.outputs.packages.${system}.default
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
              "FRONTEND_FOLDER=${packages.openfront-frontend}"
            ];
            #Cmd = [ "openfrontpro" ];
          };
        };
      }
    );
}
