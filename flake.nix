{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    utils.url = "github:numtide/flake-utils";

    rust = {
      url = "path:./rust";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    frontend = {
      url = "path:./frontend";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    simulator = {
      url = "path:./simulator";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.bun2nix.follows = "bun2nix";
      inputs.openfrontio_a221fee.follows = "openfrontio_a221fee";
      inputs.flake-utils.follows = "utils";
    };

    bun2nix.url = "github:baileyluTCD/bun2nix";

    openfrontio_a221fee = {
      url = "github:OpenFrontIO/OpenFrontIO/a221fee92146caaefdee8a287e341a18da11716b";
      flake = false;          # matches simulator/flake.nix
    };
  };

  outputs = { self, nixpkgs, utils, rust, simulator, frontend, bun2nix, openfrontio_a221fee }:
    utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      rec {
        packages.default = packages.container;

        # This exists to act like the docker image, except only as a nix executable.
        # It only has two inputs, packages.openfrontpro and packages.openfront-frontend.
        packages.backend = pkgs.stdenv.mkDerivation {
          name = "openfrontpro-bundle";
          src = ./.;
            buildInputs = [
                rust.outputs.packages.${system}.default
                frontend.outputs.packages.${system}.default
                pkgs.cacert
                pkgs.bashInteractive
                pkgs.coreutils
                pkgs.curl
            ];
            nativeBuildInputs = [ pkgs.makeWrapper ];
            installPhase = ''
              mkdir -p $out/bin
              cp ${rust.outputs.packages.${system}.default}/bin/openfrontpro $out/bin/openfrontpro-bundle
              wrapProgram $out/bin/openfrontpro-bundle \
                --set FRONTEND_FOLDER ${frontend.outputs.packages.${system}.default} \
                --set RUST_LOG info
            '';
        };

        packages.container = pkgs.dockerTools.buildLayeredImage {
          name = "openfrontpro";
          contents = [
                packages.backend
                frontend.outputs.packages.${system}.default
          ];

          config = {
            ExposedPorts = { "3000/tcp" = { }; };
            EntryPoint = [ "${packages.backend}/bin/openfrontpro" ];
            Env = [
              "RUST_LOG=info"
              "FRONTEND_FOLDER=${frontend.outputs.packages.${system}.default}"
            ];
            #Cmd = [ "openfrontpro" ];
          };
        };

        packages.simulator = simulator.outputs.packages.${system}.default;
        packages.container-sim = pkgs.dockerTools.buildLayeredImage {
          name = "openfrontpro-simulator";
          contents = [
            packages.simulator
            #simulator.outputs.packages.${system}.default
            pkgs.fish
          ];

          config = {
            #ExposedPorts = { "3000/tcp" = { }; };
            #EntryPoint = [ "${packages.simulator}/bin/openfronter-sim" ];
            EntryPoint = [ "${pkgs.fish}/bin/fish" ];
            Env = [
              #"RUST_LOG=info"
              #"FRONTEND_FOLDER=${frontend.outputs.packages.${system}.default}"
            ];
            Cmd = [ "-c" "echo 'test'" ];
          };
        };
      }
    );
}
