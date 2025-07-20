{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    utils.url = "github:numtide/flake-utils";

    rust = {
      url = "path:./rust";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    #frontend = {
      #url = "path:./frontend";
      #inputs.nixpkgs.follows = "nixpkgs";
    #};

    simulator = {
      url = "path:./simulator";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, utils, rust, simulator }:
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
                #frontend.outputs.packages.${system}.default
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
                --set RUST_LOG info
                #--set FRONTEND_FOLDER ${frontend.outputs.packages.${system}.default}
            '';
        };

        packages.container = pkgs.dockerTools.buildLayeredImage {
          name = "openfrontpro";
          contents = [
            #frontend.outputs.packages.${system}.default
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
            EntryPoint = [ "${rust.outputs.packages.${system}.default}/bin/openfrontpro" ];
            Env = [
              "RUST_LOG=info"
              #"FRONTEND_FOLDER=${frontend.outputs.packages.${system}.default}"
            ];
            #Cmd = [ "openfrontpro" ];
          };
        };
      }
    );
}
