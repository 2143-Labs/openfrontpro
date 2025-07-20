{ mkYarnPackage, pkgs, ... }:

mkYarnPackage {
    name = "openfront-pro-frontend";
    src = ./.;
    packageJSON = ./package.json;
    yarnLock = ./yarn.lock;
    # NOTE: this is optional and generated dynamically if omitted
    yarnNix = ./yarn.nix;
}
