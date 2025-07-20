{ mkBunDerivation, pkgs, ... }:

mkBunDerivation {
  src = ./.;
  packageJson = ./package.json;
  bunNix = ./bun.nix;

  meta = with pkgs.lib; {
    description = "openfront.pro frontend";
    homepage = "https://github.com/John2143/openfronter";
    license = licenses.mit;
    maintainers = [
        {
            name = "John2143";
            email = "john@john2143.com";
            github = "john2143";
            githubId = 365430;
        }
    ];
    platforms = platforms.all;
  };

  installPhase = ''
    bun install
  '';
}
