{ mkBunDerivation, pkgs, ... }:

mkBunDerivation {
  pname = "openfront-simulator";
  version = "0.1.0";

  src = ./.;

  bunNix = ./bun.nix;

  # Specify runtime dependencies
  buildInputs = [
    pkgs.bun
  ];

  # Override default build phase to use Vite instead of bun compile
  buildPhase = ''
    runHook preBuild

    runHook postBuild
  '';

  # Override default install phase to install static files instead of binary
  installPhase = ''
    runHook preInstall

    mkdir -p $out

    runHook postInstall
  '';

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
}
