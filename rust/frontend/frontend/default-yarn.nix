{ pkgs ? import <nixpkgs> { } }:
let
  yarnLock = ./yarn.lock;
  yarnDeps = pkgs.fetchYarnDeps {
    inherit yarnLock;
    sha256 = "0000000000000000000000000000000000000000000000000000"; # to be fixed
  };
in
pkgs.buildNpmPackage {
  pname = "openfront-frontend";
  version = "0.1.0";
  src = ./.;

  npmDeps = yarnDeps;
  # Ensure Vite is in PATH for build
  buildInputs = [ pkgs.nodePackages.vite ];
  installPhase = ''
    mkdir -p $out
    cp -r dist $out/
  '';
}
