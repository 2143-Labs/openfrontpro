{ pkgs ? import <nixpkgs> { } }:
let
  yarnLock = ./yarn.lock;
  yarnDeps = pkgs.fetchYarnDeps {
    inherit yarnLock;
    sha256 = "0000000000000000000000000000000000000000000000000000"; # to be fixed
  };
in
pkgs.stdenv.mkDerivation {
  pname = "openfront-frontend";
  version = "0.1.0";
  src = ./.;

  nativeBuildInputs = with pkgs; [ nodejs yarn ];
  
  configurePhase = ''
    export HOME=$(mktemp -d)
    yarn config set yarn-offline-mirror $yarnDeps
    yarn install --offline --frozen-lockfile --ignore-platform --ignore-scripts --no-progress --non-interactive
    patchShebangs .
  '';
  
  buildPhase = ''
    yarn build
  '';
  
  installPhase = ''
    mkdir -p $out
    cp -r dist/* $out/
  '';
}
