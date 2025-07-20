{ fetchurl, fetchgit, linkFarm, runCommand, gnutar }: rec {
  offline_cache = linkFarm "offline" packages;
  packages = [
    {
      name = "_ampproject_remapping___remapping_2.3.0.tgz";
      path = fetchurl {
        name = "_ampproject_remapping___remapping_2.3.0.tgz";
        url  = "https://registry.yarnpkg.com/@ampproject/remapping/-/remapping-2.3.0.tgz";
        sha512 = "30iZtAPgz+LTIYoeivqYo853f02jBYSd5uGnGpkFV0M3xOt9aN73erkgYAmZU43x4VfqcnLxW9Kpg3R5LC4YYw==";
      };
    }
    {
      name = "_babel_code_frame___code_frame_7.27.1.tgz";
      path = fetchurl {
        name = "_babel_code_frame___code_frame_7.27.1.tgz";
        url  = "https://registry.yarnpkg.com/@babel/code-frame/-/code-frame-7.27.1.tgz";
        sha512 = "cjQ7ZlQ0Mv3b47hABuTevyTuYN4i+loJKGeV9flcCgIK37cCXRh+L1bd3iBHlynerhQ7BhCkn2BPbQUL+rGqFg==";
      };
    }
    {
      name = "_babel_compat_data___compat_data_7.28.0.tgz";
      path = fetchurl {
        name = "_babel_compat_data___compat_data_7.28.0.tgz";
        url  = "https://registry.yarnpkg.com/@babel/compat-data/-/compat-data-7.28.0.tgz";
        sha512 = "60X7qkglvrap8mn1lh2ebxXdZYtUcpd7gsmy9kLaBJ4i/WdY8PqTSdxyA8qraikqKQK5C1KRBKXqznrVapyNaw==";
      };
    }
    {
      name = "_babel_core___core_7.28.0.tgz";
      path = fetchurl {
        name = "_babel_core___core_7.28.0.tgz";
        url  = "https://registry.yarnpkg.com/@babel/core/-/core-7.28.0.tgz";
        sha512 = "UlLAnTPrFdNGoFtbSXwcGFQBtQZJCNjaN6hQNP3UPvuNXT1i82N26KL3dZeIpNalWywr9IuQuncaAfUaS1g6sQ==";
      };
    }
    {
      name = "_babel_generator___generator_7.28.0.tgz";
      path = fetchurl {
        name = "_babel_generator___generator_7.28.0.tgz";
        url  = "https://registry.yarnpkg.com/@babel/generator/-/generator-7.28.0.tgz";
        sha512 = "lJjzvrbEeWrhB4P3QBsH7tey117PjLZnDbLiQEKjQ/fNJTjuq4HSqgFA+UNSwZT8D7dxxbnuSBMsa1lrWzKlQg==";
      };
    }
    {
      name = "_babel_helper_compilation_targets___helper_compilation_targets_7.27.2.tgz";
      path = fetchurl {
        name = "_babel_helper_compilation_targets___helper_compilation_targets_7.27.2.tgz";
        url  = "https://registry.yarnpkg.com/@babel/helper-compilation-targets/-/helper-compilation-targets-7.27.2.tgz";
        sha512 = "2+1thGUUWWjLTYTHZWK1n8Yga0ijBz1XAhUXcKy81rd5g6yh7hGqMp45v7cadSbEHc9G3OTv45SyneRN3ps4DQ==";
      };
    }
    {
      name = "_babel_helper_globals___helper_globals_7.28.0.tgz";
      path = fetchurl {
        name = "_babel_helper_globals___helper_globals_7.28.0.tgz";
        url  = "https://registry.yarnpkg.com/@babel/helper-globals/-/helper-globals-7.28.0.tgz";
        sha512 = "+W6cISkXFa1jXsDEdYA8HeevQT/FULhxzR99pxphltZcVaugps53THCeiWA8SguxxpSp3gKPiuYfSWopkLQ4hw==";
      };
    }
    {
      name = "_babel_helper_module_imports___helper_module_imports_7.27.1.tgz";
      path = fetchurl {
        name = "_babel_helper_module_imports___helper_module_imports_7.27.1.tgz";
        url  = "https://registry.yarnpkg.com/@babel/helper-module-imports/-/helper-module-imports-7.27.1.tgz";
        sha512 = "0gSFWUPNXNopqtIPQvlD5WgXYI5GY2kP2cCvoT8kczjbfcfuIljTbcWrulD1CIPIX2gt1wghbDy08yE1p+/r3w==";
      };
    }
    {
      name = "_babel_helper_module_transforms___helper_module_transforms_7.27.3.tgz";
      path = fetchurl {
        name = "_babel_helper_module_transforms___helper_module_transforms_7.27.3.tgz";
        url  = "https://registry.yarnpkg.com/@babel/helper-module-transforms/-/helper-module-transforms-7.27.3.tgz";
        sha512 = "dSOvYwvyLsWBeIRyOeHXp5vPj5l1I011r52FM1+r1jCERv+aFXYk4whgQccYEGYxK2H3ZAIA8nuPkQ0HaUo3qg==";
      };
    }
    {
      name = "_babel_helper_plugin_utils___helper_plugin_utils_7.27.1.tgz";
      path = fetchurl {
        name = "_babel_helper_plugin_utils___helper_plugin_utils_7.27.1.tgz";
        url  = "https://registry.yarnpkg.com/@babel/helper-plugin-utils/-/helper-plugin-utils-7.27.1.tgz";
        sha512 = "1gn1Up5YXka3YYAHGKpbideQ5Yjf1tDa9qYcgysz+cNCXukyLl6DjPXhD3VRwSb8c0J9tA4b2+rHEZtc6R0tlw==";
      };
    }
    {
      name = "_babel_helper_string_parser___helper_string_parser_7.27.1.tgz";
      path = fetchurl {
        name = "_babel_helper_string_parser___helper_string_parser_7.27.1.tgz";
        url  = "https://registry.yarnpkg.com/@babel/helper-string-parser/-/helper-string-parser-7.27.1.tgz";
        sha512 = "qMlSxKbpRlAridDExk92nSobyDdpPijUq2DW6oDnUqd0iOGxmQjyqhMIihI9+zv4LPyZdRje2cavWPbCbWm3eA==";
      };
    }
    {
      name = "_babel_helper_validator_identifier___helper_validator_identifier_7.27.1.tgz";
      path = fetchurl {
        name = "_babel_helper_validator_identifier___helper_validator_identifier_7.27.1.tgz";
        url  = "https://registry.yarnpkg.com/@babel/helper-validator-identifier/-/helper-validator-identifier-7.27.1.tgz";
        sha512 = "D2hP9eA+Sqx1kBZgzxZh0y1trbuU+JoDkiEwqhQ36nodYqJwyEIhPSdMNd7lOm/4io72luTPWH20Yda0xOuUow==";
      };
    }
    {
      name = "_babel_helper_validator_option___helper_validator_option_7.27.1.tgz";
      path = fetchurl {
        name = "_babel_helper_validator_option___helper_validator_option_7.27.1.tgz";
        url  = "https://registry.yarnpkg.com/@babel/helper-validator-option/-/helper-validator-option-7.27.1.tgz";
        sha512 = "YvjJow9FxbhFFKDSuFnVCe2WxXk1zWc22fFePVNEaWJEu8IrZVlda6N0uHwzZrUM1il7NC9Mlp4MaJYbYd9JSg==";
      };
    }
    {
      name = "_babel_helpers___helpers_7.27.6.tgz";
      path = fetchurl {
        name = "_babel_helpers___helpers_7.27.6.tgz";
        url  = "https://registry.yarnpkg.com/@babel/helpers/-/helpers-7.27.6.tgz";
        sha512 = "muE8Tt8M22638HU31A3CgfSUciwz1fhATfoVai05aPXGor//CdWDCbnlY1yvBPo07njuVOCNGCSp/GTt12lIug==";
      };
    }
    {
      name = "_babel_parser___parser_7.28.0.tgz";
      path = fetchurl {
        name = "_babel_parser___parser_7.28.0.tgz";
        url  = "https://registry.yarnpkg.com/@babel/parser/-/parser-7.28.0.tgz";
        sha512 = "jVZGvOxOuNSsuQuLRTh13nU0AogFlw32w/MT+LV6D3sP5WdbW61E77RnkbaO2dUvmPAYrBDJXGn5gGS6tH4j8g==";
      };
    }
    {
      name = "_babel_plugin_transform_react_jsx_self___plugin_transform_react_jsx_self_7.27.1.tgz";
      path = fetchurl {
        name = "_babel_plugin_transform_react_jsx_self___plugin_transform_react_jsx_self_7.27.1.tgz";
        url  = "https://registry.yarnpkg.com/@babel/plugin-transform-react-jsx-self/-/plugin-transform-react-jsx-self-7.27.1.tgz";
        sha512 = "6UzkCs+ejGdZ5mFFC/OCUrv028ab2fp1znZmCZjAOBKiBK2jXD1O+BPSfX8X2qjJ75fZBMSnQn3Rq2mrBJK2mw==";
      };
    }
    {
      name = "_babel_plugin_transform_react_jsx_source___plugin_transform_react_jsx_source_7.27.1.tgz";
      path = fetchurl {
        name = "_babel_plugin_transform_react_jsx_source___plugin_transform_react_jsx_source_7.27.1.tgz";
        url  = "https://registry.yarnpkg.com/@babel/plugin-transform-react-jsx-source/-/plugin-transform-react-jsx-source-7.27.1.tgz";
        sha512 = "zbwoTsBruTeKB9hSq73ha66iFeJHuaFkUbwvqElnygoNbj/jHRsSeokowZFN3CZ64IvEqcmmkVe89OPXc7ldAw==";
      };
    }
    {
      name = "_babel_template___template_7.27.2.tgz";
      path = fetchurl {
        name = "_babel_template___template_7.27.2.tgz";
        url  = "https://registry.yarnpkg.com/@babel/template/-/template-7.27.2.tgz";
        sha512 = "LPDZ85aEJyYSd18/DkjNh4/y1ntkE5KwUHWTiqgRxruuZL2F1yuHligVHLvcHY2vMHXttKFpJn6LwfI7cw7ODw==";
      };
    }
    {
      name = "_babel_traverse___traverse_7.28.0.tgz";
      path = fetchurl {
        name = "_babel_traverse___traverse_7.28.0.tgz";
        url  = "https://registry.yarnpkg.com/@babel/traverse/-/traverse-7.28.0.tgz";
        sha512 = "mGe7UK5wWyh0bKRfupsUchrQGqvDbZDbKJw+kcRGSmdHVYrv+ltd0pnpDTVpiTqnaBru9iEvA8pz8W46v0Amwg==";
      };
    }
    {
      name = "_babel_types___types_7.28.1.tgz";
      path = fetchurl {
        name = "_babel_types___types_7.28.1.tgz";
        url  = "https://registry.yarnpkg.com/@babel/types/-/types-7.28.1.tgz";
        sha512 = "x0LvFTekgSX+83TI28Y9wYPUfzrnl2aT5+5QLnO6v7mSJYtEEevuDRN0F0uSHRk1G1IWZC43o00Y0xDDrpBGPQ==";
      };
    }
    {
      name = "_esbuild_aix_ppc64___aix_ppc64_0.25.7.tgz";
      path = fetchurl {
        name = "_esbuild_aix_ppc64___aix_ppc64_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/@esbuild/aix-ppc64/-/aix-ppc64-0.25.7.tgz";
        sha512 = "uD0kKFHh6ETr8TqEtaAcV+dn/2qnYbH/+8wGEdY70Qf7l1l/jmBUbrmQqwiPKAQE6cOQ7dTj6Xr0HzQDGHyceQ==";
      };
    }
    {
      name = "_esbuild_android_arm64___android_arm64_0.25.7.tgz";
      path = fetchurl {
        name = "_esbuild_android_arm64___android_arm64_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/@esbuild/android-arm64/-/android-arm64-0.25.7.tgz";
        sha512 = "p0ohDnwyIbAtztHTNUTzN5EGD/HJLs1bwysrOPgSdlIA6NDnReoVfoCyxG6W1d85jr2X80Uq5KHftyYgaK9LPQ==";
      };
    }
    {
      name = "_esbuild_android_arm___android_arm_0.25.7.tgz";
      path = fetchurl {
        name = "_esbuild_android_arm___android_arm_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/@esbuild/android-arm/-/android-arm-0.25.7.tgz";
        sha512 = "Jhuet0g1k9rAJHrXGIh7sFknFuT4sfytYZpZpuZl7YKDhnPByVAm5oy2LEBmMbuYf3ejWVYCc2seX81Mk+madA==";
      };
    }
    {
      name = "_esbuild_android_x64___android_x64_0.25.7.tgz";
      path = fetchurl {
        name = "_esbuild_android_x64___android_x64_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/@esbuild/android-x64/-/android-x64-0.25.7.tgz";
        sha512 = "mMxIJFlSgVK23HSsII3ZX9T2xKrBCDGyk0qiZnIW10LLFFtZLkFD6imZHu7gUo2wkNZwS9Yj3mOtZD3ZPcjCcw==";
      };
    }
    {
      name = "_esbuild_darwin_arm64___darwin_arm64_0.25.7.tgz";
      path = fetchurl {
        name = "_esbuild_darwin_arm64___darwin_arm64_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/@esbuild/darwin-arm64/-/darwin-arm64-0.25.7.tgz";
        sha512 = "jyOFLGP2WwRwxM8F1VpP6gcdIJc8jq2CUrURbbTouJoRO7XCkU8GdnTDFIHdcifVBT45cJlOYsZ1kSlfbKjYUQ==";
      };
    }
    {
      name = "_esbuild_darwin_x64___darwin_x64_0.25.7.tgz";
      path = fetchurl {
        name = "_esbuild_darwin_x64___darwin_x64_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/@esbuild/darwin-x64/-/darwin-x64-0.25.7.tgz";
        sha512 = "m9bVWqZCwQ1BthruifvG64hG03zzz9gE2r/vYAhztBna1/+qXiHyP9WgnyZqHgGeXoimJPhAmxfbeU+nMng6ZA==";
      };
    }
    {
      name = "_esbuild_freebsd_arm64___freebsd_arm64_0.25.7.tgz";
      path = fetchurl {
        name = "_esbuild_freebsd_arm64___freebsd_arm64_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/@esbuild/freebsd-arm64/-/freebsd-arm64-0.25.7.tgz";
        sha512 = "Bss7P4r6uhr3kDzRjPNEnTm/oIBdTPRNQuwaEFWT/uvt6A1YzK/yn5kcx5ZxZ9swOga7LqeYlu7bDIpDoS01bA==";
      };
    }
    {
      name = "_esbuild_freebsd_x64___freebsd_x64_0.25.7.tgz";
      path = fetchurl {
        name = "_esbuild_freebsd_x64___freebsd_x64_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/@esbuild/freebsd-x64/-/freebsd-x64-0.25.7.tgz";
        sha512 = "S3BFyjW81LXG7Vqmr37ddbThrm3A84yE7ey/ERBlK9dIiaWgrjRlre3pbG7txh1Uaxz8N7wGGQXmC9zV+LIpBQ==";
      };
    }
    {
      name = "_esbuild_linux_arm64___linux_arm64_0.25.7.tgz";
      path = fetchurl {
        name = "_esbuild_linux_arm64___linux_arm64_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/@esbuild/linux-arm64/-/linux-arm64-0.25.7.tgz";
        sha512 = "HfQZQqrNOfS1Okn7PcsGUqHymL1cWGBslf78dGvtrj8q7cN3FkapFgNA4l/a5lXDwr7BqP2BSO6mz9UremNPbg==";
      };
    }
    {
      name = "_esbuild_linux_arm___linux_arm_0.25.7.tgz";
      path = fetchurl {
        name = "_esbuild_linux_arm___linux_arm_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/@esbuild/linux-arm/-/linux-arm-0.25.7.tgz";
        sha512 = "JZMIci/1m5vfQuhKoFXogCKVYVfYQmoZJg8vSIMR4TUXbF+0aNlfXH3DGFEFMElT8hOTUF5hisdZhnrZO/bkDw==";
      };
    }
    {
      name = "_esbuild_linux_ia32___linux_ia32_0.25.7.tgz";
      path = fetchurl {
        name = "_esbuild_linux_ia32___linux_ia32_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/@esbuild/linux-ia32/-/linux-ia32-0.25.7.tgz";
        sha512 = "9Jex4uVpdeofiDxnwHRgen+j6398JlX4/6SCbbEFEXN7oMO2p0ueLN+e+9DdsdPLUdqns607HmzEFnxwr7+5wQ==";
      };
    }
    {
      name = "_esbuild_linux_loong64___linux_loong64_0.25.7.tgz";
      path = fetchurl {
        name = "_esbuild_linux_loong64___linux_loong64_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/@esbuild/linux-loong64/-/linux-loong64-0.25.7.tgz";
        sha512 = "TG1KJqjBlN9IHQjKVUYDB0/mUGgokfhhatlay8aZ/MSORMubEvj/J1CL8YGY4EBcln4z7rKFbsH+HeAv0d471w==";
      };
    }
    {
      name = "_esbuild_linux_mips64el___linux_mips64el_0.25.7.tgz";
      path = fetchurl {
        name = "_esbuild_linux_mips64el___linux_mips64el_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/@esbuild/linux-mips64el/-/linux-mips64el-0.25.7.tgz";
        sha512 = "Ty9Hj/lx7ikTnhOfaP7ipEm/ICcBv94i/6/WDg0OZ3BPBHhChsUbQancoWYSO0WNkEiSW5Do4febTTy4x1qYQQ==";
      };
    }
    {
      name = "_esbuild_linux_ppc64___linux_ppc64_0.25.7.tgz";
      path = fetchurl {
        name = "_esbuild_linux_ppc64___linux_ppc64_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/@esbuild/linux-ppc64/-/linux-ppc64-0.25.7.tgz";
        sha512 = "MrOjirGQWGReJl3BNQ58BLhUBPpWABnKrnq8Q/vZWWwAB1wuLXOIxS2JQ1LT3+5T+3jfPh0tyf5CpbyQHqnWIQ==";
      };
    }
    {
      name = "_esbuild_linux_riscv64___linux_riscv64_0.25.7.tgz";
      path = fetchurl {
        name = "_esbuild_linux_riscv64___linux_riscv64_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/@esbuild/linux-riscv64/-/linux-riscv64-0.25.7.tgz";
        sha512 = "9pr23/pqzyqIZEZmQXnFyqp3vpa+KBk5TotfkzGMqpw089PGm0AIowkUppHB9derQzqniGn3wVXgck19+oqiOw==";
      };
    }
    {
      name = "_esbuild_linux_s390x___linux_s390x_0.25.7.tgz";
      path = fetchurl {
        name = "_esbuild_linux_s390x___linux_s390x_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/@esbuild/linux-s390x/-/linux-s390x-0.25.7.tgz";
        sha512 = "4dP11UVGh9O6Y47m8YvW8eoA3r8qL2toVZUbBKyGta8j6zdw1cn9F/Rt59/Mhv0OgY68pHIMjGXWOUaykCnx+w==";
      };
    }
    {
      name = "_esbuild_linux_x64___linux_x64_0.25.7.tgz";
      path = fetchurl {
        name = "_esbuild_linux_x64___linux_x64_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/@esbuild/linux-x64/-/linux-x64-0.25.7.tgz";
        sha512 = "ghJMAJTdw/0uhz7e7YnpdX1xVn7VqA0GrWrAO2qKMuqbvgHT2VZiBv1BQ//VcHsPir4wsL3P2oPggfKPzTKoCA==";
      };
    }
    {
      name = "_esbuild_netbsd_arm64___netbsd_arm64_0.25.7.tgz";
      path = fetchurl {
        name = "_esbuild_netbsd_arm64___netbsd_arm64_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/@esbuild/netbsd-arm64/-/netbsd-arm64-0.25.7.tgz";
        sha512 = "bwXGEU4ua45+u5Ci/a55B85KWaDSRS8NPOHtxy2e3etDjbz23wlry37Ffzapz69JAGGc4089TBo+dGzydQmydg==";
      };
    }
    {
      name = "_esbuild_netbsd_x64___netbsd_x64_0.25.7.tgz";
      path = fetchurl {
        name = "_esbuild_netbsd_x64___netbsd_x64_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/@esbuild/netbsd-x64/-/netbsd-x64-0.25.7.tgz";
        sha512 = "tUZRvLtgLE5OyN46sPSYlgmHoBS5bx2URSrgZdW1L1teWPYVmXh+QN/sKDqkzBo/IHGcKcHLKDhBeVVkO7teEA==";
      };
    }
    {
      name = "_esbuild_openbsd_arm64___openbsd_arm64_0.25.7.tgz";
      path = fetchurl {
        name = "_esbuild_openbsd_arm64___openbsd_arm64_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/@esbuild/openbsd-arm64/-/openbsd-arm64-0.25.7.tgz";
        sha512 = "bTJ50aoC+WDlDGBReWYiObpYvQfMjBNlKztqoNUL0iUkYtwLkBQQeEsTq/I1KyjsKA5tyov6VZaPb8UdD6ci6Q==";
      };
    }
    {
      name = "_esbuild_openbsd_x64___openbsd_x64_0.25.7.tgz";
      path = fetchurl {
        name = "_esbuild_openbsd_x64___openbsd_x64_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/@esbuild/openbsd-x64/-/openbsd-x64-0.25.7.tgz";
        sha512 = "TA9XfJrgzAipFUU895jd9j2SyDh9bbNkK2I0gHcvqb/o84UeQkBpi/XmYX3cO1q/9hZokdcDqQxIi6uLVrikxg==";
      };
    }
    {
      name = "_esbuild_openharmony_arm64___openharmony_arm64_0.25.7.tgz";
      path = fetchurl {
        name = "_esbuild_openharmony_arm64___openharmony_arm64_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/@esbuild/openharmony-arm64/-/openharmony-arm64-0.25.7.tgz";
        sha512 = "5VTtExUrWwHHEUZ/N+rPlHDwVFQ5aME7vRJES8+iQ0xC/bMYckfJ0l2n3yGIfRoXcK/wq4oXSItZAz5wslTKGw==";
      };
    }
    {
      name = "_esbuild_sunos_x64___sunos_x64_0.25.7.tgz";
      path = fetchurl {
        name = "_esbuild_sunos_x64___sunos_x64_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/@esbuild/sunos-x64/-/sunos-x64-0.25.7.tgz";
        sha512 = "umkbn7KTxsexhv2vuuJmj9kggd4AEtL32KodkJgfhNOHMPtQ55RexsaSrMb+0+jp9XL4I4o2y91PZauVN4cH3A==";
      };
    }
    {
      name = "_esbuild_win32_arm64___win32_arm64_0.25.7.tgz";
      path = fetchurl {
        name = "_esbuild_win32_arm64___win32_arm64_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/@esbuild/win32-arm64/-/win32-arm64-0.25.7.tgz";
        sha512 = "j20JQGP/gz8QDgzl5No5Gr4F6hurAZvtkFxAKhiv2X49yi/ih8ECK4Y35YnjlMogSKJk931iNMcd35BtZ4ghfw==";
      };
    }
    {
      name = "_esbuild_win32_ia32___win32_ia32_0.25.7.tgz";
      path = fetchurl {
        name = "_esbuild_win32_ia32___win32_ia32_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/@esbuild/win32-ia32/-/win32-ia32-0.25.7.tgz";
        sha512 = "4qZ6NUfoiiKZfLAXRsvFkA0hoWVM+1y2bSHXHkpdLAs/+r0LgwqYohmfZCi985c6JWHhiXP30mgZawn/XrqAkQ==";
      };
    }
    {
      name = "_esbuild_win32_x64___win32_x64_0.25.7.tgz";
      path = fetchurl {
        name = "_esbuild_win32_x64___win32_x64_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/@esbuild/win32-x64/-/win32-x64-0.25.7.tgz";
        sha512 = "FaPsAHTwm+1Gfvn37Eg3E5HIpfR3i6x1AIcla/MkqAIupD4BW3MrSeUqfoTzwwJhk3WE2/KqUn4/eenEJC76VA==";
      };
    }
    {
      name = "_jridgewell_gen_mapping___gen_mapping_0.3.12.tgz";
      path = fetchurl {
        name = "_jridgewell_gen_mapping___gen_mapping_0.3.12.tgz";
        url  = "https://registry.yarnpkg.com/@jridgewell/gen-mapping/-/gen-mapping-0.3.12.tgz";
        sha512 = "OuLGC46TjB5BbN1dH8JULVVZY4WTdkF7tV9Ys6wLL1rubZnCMstOhNHueU5bLCrnRuDhKPDM4g6sw4Bel5Gzqg==";
      };
    }
    {
      name = "_jridgewell_resolve_uri___resolve_uri_3.1.2.tgz";
      path = fetchurl {
        name = "_jridgewell_resolve_uri___resolve_uri_3.1.2.tgz";
        url  = "https://registry.yarnpkg.com/@jridgewell/resolve-uri/-/resolve-uri-3.1.2.tgz";
        sha512 = "bRISgCIjP20/tbWSPWMEi54QVPRZExkuD9lJL+UIxUKtwVJA8wW1Trb1jMs1RFXo1CBTNZ/5hpC9QvmKWdopKw==";
      };
    }
    {
      name = "_jridgewell_sourcemap_codec___sourcemap_codec_1.5.4.tgz";
      path = fetchurl {
        name = "_jridgewell_sourcemap_codec___sourcemap_codec_1.5.4.tgz";
        url  = "https://registry.yarnpkg.com/@jridgewell/sourcemap-codec/-/sourcemap-codec-1.5.4.tgz";
        sha512 = "VT2+G1VQs/9oz078bLrYbecdZKs912zQlkelYpuf+SXF+QvZDYJlbx/LSx+meSAwdDFnF8FVXW92AVjjkVmgFw==";
      };
    }
    {
      name = "_jridgewell_trace_mapping___trace_mapping_0.3.29.tgz";
      path = fetchurl {
        name = "_jridgewell_trace_mapping___trace_mapping_0.3.29.tgz";
        url  = "https://registry.yarnpkg.com/@jridgewell/trace-mapping/-/trace-mapping-0.3.29.tgz";
        sha512 = "uw6guiW/gcAGPDhLmd77/6lW8QLeiV5RUTsAX46Db6oLhGaVj4lhnPwb184s1bkc8kdVg/+h988dro8GRDpmYQ==";
      };
    }
    {
      name = "_rolldown_pluginutils___pluginutils_1.0.0_beta.27.tgz";
      path = fetchurl {
        name = "_rolldown_pluginutils___pluginutils_1.0.0_beta.27.tgz";
        url  = "https://registry.yarnpkg.com/@rolldown/pluginutils/-/pluginutils-1.0.0-beta.27.tgz";
        sha512 = "+d0F4MKMCbeVUJwG96uQ4SgAznZNSq93I3V+9NHA4OpvqG8mRCpGdKmK8l/dl02h2CCDHwW2FqilnTyDcAnqjA==";
      };
    }
    {
      name = "_rollup_rollup_android_arm_eabi___rollup_android_arm_eabi_4.45.1.tgz";
      path = fetchurl {
        name = "_rollup_rollup_android_arm_eabi___rollup_android_arm_eabi_4.45.1.tgz";
        url  = "https://registry.yarnpkg.com/@rollup/rollup-android-arm-eabi/-/rollup-android-arm-eabi-4.45.1.tgz";
        sha512 = "NEySIFvMY0ZQO+utJkgoMiCAjMrGvnbDLHvcmlA33UXJpYBCvlBEbMMtV837uCkS+plG2umfhn0T5mMAxGrlRA==";
      };
    }
    {
      name = "_rollup_rollup_android_arm64___rollup_android_arm64_4.45.1.tgz";
      path = fetchurl {
        name = "_rollup_rollup_android_arm64___rollup_android_arm64_4.45.1.tgz";
        url  = "https://registry.yarnpkg.com/@rollup/rollup-android-arm64/-/rollup-android-arm64-4.45.1.tgz";
        sha512 = "ujQ+sMXJkg4LRJaYreaVx7Z/VMgBBd89wGS4qMrdtfUFZ+TSY5Rs9asgjitLwzeIbhwdEhyj29zhst3L1lKsRQ==";
      };
    }
    {
      name = "_rollup_rollup_darwin_arm64___rollup_darwin_arm64_4.45.1.tgz";
      path = fetchurl {
        name = "_rollup_rollup_darwin_arm64___rollup_darwin_arm64_4.45.1.tgz";
        url  = "https://registry.yarnpkg.com/@rollup/rollup-darwin-arm64/-/rollup-darwin-arm64-4.45.1.tgz";
        sha512 = "FSncqHvqTm3lC6Y13xncsdOYfxGSLnP+73k815EfNmpewPs+EyM49haPS105Rh4aF5mJKywk9X0ogzLXZzN9lA==";
      };
    }
    {
      name = "_rollup_rollup_darwin_x64___rollup_darwin_x64_4.45.1.tgz";
      path = fetchurl {
        name = "_rollup_rollup_darwin_x64___rollup_darwin_x64_4.45.1.tgz";
        url  = "https://registry.yarnpkg.com/@rollup/rollup-darwin-x64/-/rollup-darwin-x64-4.45.1.tgz";
        sha512 = "2/vVn/husP5XI7Fsf/RlhDaQJ7x9zjvC81anIVbr4b/f0xtSmXQTFcGIQ/B1cXIYM6h2nAhJkdMHTnD7OtQ9Og==";
      };
    }
    {
      name = "_rollup_rollup_freebsd_arm64___rollup_freebsd_arm64_4.45.1.tgz";
      path = fetchurl {
        name = "_rollup_rollup_freebsd_arm64___rollup_freebsd_arm64_4.45.1.tgz";
        url  = "https://registry.yarnpkg.com/@rollup/rollup-freebsd-arm64/-/rollup-freebsd-arm64-4.45.1.tgz";
        sha512 = "4g1kaDxQItZsrkVTdYQ0bxu4ZIQ32cotoQbmsAnW1jAE4XCMbcBPDirX5fyUzdhVCKgPcrwWuucI8yrVRBw2+g==";
      };
    }
    {
      name = "_rollup_rollup_freebsd_x64___rollup_freebsd_x64_4.45.1.tgz";
      path = fetchurl {
        name = "_rollup_rollup_freebsd_x64___rollup_freebsd_x64_4.45.1.tgz";
        url  = "https://registry.yarnpkg.com/@rollup/rollup-freebsd-x64/-/rollup-freebsd-x64-4.45.1.tgz";
        sha512 = "L/6JsfiL74i3uK1Ti2ZFSNsp5NMiM4/kbbGEcOCps99aZx3g8SJMO1/9Y0n/qKlWZfn6sScf98lEOUe2mBvW9A==";
      };
    }
    {
      name = "_rollup_rollup_linux_arm_gnueabihf___rollup_linux_arm_gnueabihf_4.45.1.tgz";
      path = fetchurl {
        name = "_rollup_rollup_linux_arm_gnueabihf___rollup_linux_arm_gnueabihf_4.45.1.tgz";
        url  = "https://registry.yarnpkg.com/@rollup/rollup-linux-arm-gnueabihf/-/rollup-linux-arm-gnueabihf-4.45.1.tgz";
        sha512 = "RkdOTu2jK7brlu+ZwjMIZfdV2sSYHK2qR08FUWcIoqJC2eywHbXr0L8T/pONFwkGukQqERDheaGTeedG+rra6Q==";
      };
    }
    {
      name = "_rollup_rollup_linux_arm_musleabihf___rollup_linux_arm_musleabihf_4.45.1.tgz";
      path = fetchurl {
        name = "_rollup_rollup_linux_arm_musleabihf___rollup_linux_arm_musleabihf_4.45.1.tgz";
        url  = "https://registry.yarnpkg.com/@rollup/rollup-linux-arm-musleabihf/-/rollup-linux-arm-musleabihf-4.45.1.tgz";
        sha512 = "3kJ8pgfBt6CIIr1o+HQA7OZ9mp/zDk3ctekGl9qn/pRBgrRgfwiffaUmqioUGN9hv0OHv2gxmvdKOkARCtRb8Q==";
      };
    }
    {
      name = "_rollup_rollup_linux_arm64_gnu___rollup_linux_arm64_gnu_4.45.1.tgz";
      path = fetchurl {
        name = "_rollup_rollup_linux_arm64_gnu___rollup_linux_arm64_gnu_4.45.1.tgz";
        url  = "https://registry.yarnpkg.com/@rollup/rollup-linux-arm64-gnu/-/rollup-linux-arm64-gnu-4.45.1.tgz";
        sha512 = "k3dOKCfIVixWjG7OXTCOmDfJj3vbdhN0QYEqB+OuGArOChek22hn7Uy5A/gTDNAcCy5v2YcXRJ/Qcnm4/ma1xw==";
      };
    }
    {
      name = "_rollup_rollup_linux_arm64_musl___rollup_linux_arm64_musl_4.45.1.tgz";
      path = fetchurl {
        name = "_rollup_rollup_linux_arm64_musl___rollup_linux_arm64_musl_4.45.1.tgz";
        url  = "https://registry.yarnpkg.com/@rollup/rollup-linux-arm64-musl/-/rollup-linux-arm64-musl-4.45.1.tgz";
        sha512 = "PmI1vxQetnM58ZmDFl9/Uk2lpBBby6B6rF4muJc65uZbxCs0EA7hhKCk2PKlmZKuyVSHAyIw3+/SiuMLxKxWog==";
      };
    }
    {
      name = "_rollup_rollup_linux_loongarch64_gnu___rollup_linux_loongarch64_gnu_4.45.1.tgz";
      path = fetchurl {
        name = "_rollup_rollup_linux_loongarch64_gnu___rollup_linux_loongarch64_gnu_4.45.1.tgz";
        url  = "https://registry.yarnpkg.com/@rollup/rollup-linux-loongarch64-gnu/-/rollup-linux-loongarch64-gnu-4.45.1.tgz";
        sha512 = "9UmI0VzGmNJ28ibHW2GpE2nF0PBQqsyiS4kcJ5vK+wuwGnV5RlqdczVocDSUfGX/Na7/XINRVoUgJyFIgipoRg==";
      };
    }
    {
      name = "_rollup_rollup_linux_powerpc64le_gnu___rollup_linux_powerpc64le_gnu_4.45.1.tgz";
      path = fetchurl {
        name = "_rollup_rollup_linux_powerpc64le_gnu___rollup_linux_powerpc64le_gnu_4.45.1.tgz";
        url  = "https://registry.yarnpkg.com/@rollup/rollup-linux-powerpc64le-gnu/-/rollup-linux-powerpc64le-gnu-4.45.1.tgz";
        sha512 = "7nR2KY8oEOUTD3pBAxIBBbZr0U7U+R9HDTPNy+5nVVHDXI4ikYniH1oxQz9VoB5PbBU1CZuDGHkLJkd3zLMWsg==";
      };
    }
    {
      name = "_rollup_rollup_linux_riscv64_gnu___rollup_linux_riscv64_gnu_4.45.1.tgz";
      path = fetchurl {
        name = "_rollup_rollup_linux_riscv64_gnu___rollup_linux_riscv64_gnu_4.45.1.tgz";
        url  = "https://registry.yarnpkg.com/@rollup/rollup-linux-riscv64-gnu/-/rollup-linux-riscv64-gnu-4.45.1.tgz";
        sha512 = "nlcl3jgUultKROfZijKjRQLUu9Ma0PeNv/VFHkZiKbXTBQXhpytS8CIj5/NfBeECZtY2FJQubm6ltIxm/ftxpw==";
      };
    }
    {
      name = "_rollup_rollup_linux_riscv64_musl___rollup_linux_riscv64_musl_4.45.1.tgz";
      path = fetchurl {
        name = "_rollup_rollup_linux_riscv64_musl___rollup_linux_riscv64_musl_4.45.1.tgz";
        url  = "https://registry.yarnpkg.com/@rollup/rollup-linux-riscv64-musl/-/rollup-linux-riscv64-musl-4.45.1.tgz";
        sha512 = "HJV65KLS51rW0VY6rvZkiieiBnurSzpzore1bMKAhunQiECPuxsROvyeaot/tcK3A3aGnI+qTHqisrpSgQrpgA==";
      };
    }
    {
      name = "_rollup_rollup_linux_s390x_gnu___rollup_linux_s390x_gnu_4.45.1.tgz";
      path = fetchurl {
        name = "_rollup_rollup_linux_s390x_gnu___rollup_linux_s390x_gnu_4.45.1.tgz";
        url  = "https://registry.yarnpkg.com/@rollup/rollup-linux-s390x-gnu/-/rollup-linux-s390x-gnu-4.45.1.tgz";
        sha512 = "NITBOCv3Qqc6hhwFt7jLV78VEO/il4YcBzoMGGNxznLgRQf43VQDae0aAzKiBeEPIxnDrACiMgbqjuihx08OOw==";
      };
    }
    {
      name = "_rollup_rollup_linux_x64_gnu___rollup_linux_x64_gnu_4.45.1.tgz";
      path = fetchurl {
        name = "_rollup_rollup_linux_x64_gnu___rollup_linux_x64_gnu_4.45.1.tgz";
        url  = "https://registry.yarnpkg.com/@rollup/rollup-linux-x64-gnu/-/rollup-linux-x64-gnu-4.45.1.tgz";
        sha512 = "+E/lYl6qu1zqgPEnTrs4WysQtvc/Sh4fC2nByfFExqgYrqkKWp1tWIbe+ELhixnenSpBbLXNi6vbEEJ8M7fiHw==";
      };
    }
    {
      name = "_rollup_rollup_linux_x64_musl___rollup_linux_x64_musl_4.45.1.tgz";
      path = fetchurl {
        name = "_rollup_rollup_linux_x64_musl___rollup_linux_x64_musl_4.45.1.tgz";
        url  = "https://registry.yarnpkg.com/@rollup/rollup-linux-x64-musl/-/rollup-linux-x64-musl-4.45.1.tgz";
        sha512 = "a6WIAp89p3kpNoYStITT9RbTbTnqarU7D8N8F2CV+4Cl9fwCOZraLVuVFvlpsW0SbIiYtEnhCZBPLoNdRkjQFw==";
      };
    }
    {
      name = "_rollup_rollup_win32_arm64_msvc___rollup_win32_arm64_msvc_4.45.1.tgz";
      path = fetchurl {
        name = "_rollup_rollup_win32_arm64_msvc___rollup_win32_arm64_msvc_4.45.1.tgz";
        url  = "https://registry.yarnpkg.com/@rollup/rollup-win32-arm64-msvc/-/rollup-win32-arm64-msvc-4.45.1.tgz";
        sha512 = "T5Bi/NS3fQiJeYdGvRpTAP5P02kqSOpqiopwhj0uaXB6nzs5JVi2XMJb18JUSKhCOX8+UE1UKQufyD6Or48dJg==";
      };
    }
    {
      name = "_rollup_rollup_win32_ia32_msvc___rollup_win32_ia32_msvc_4.45.1.tgz";
      path = fetchurl {
        name = "_rollup_rollup_win32_ia32_msvc___rollup_win32_ia32_msvc_4.45.1.tgz";
        url  = "https://registry.yarnpkg.com/@rollup/rollup-win32-ia32-msvc/-/rollup-win32-ia32-msvc-4.45.1.tgz";
        sha512 = "lxV2Pako3ujjuUe9jiU3/s7KSrDfH6IgTSQOnDWr9aJ92YsFd7EurmClK0ly/t8dzMkDtd04g60WX6yl0sGfdw==";
      };
    }
    {
      name = "_rollup_rollup_win32_x64_msvc___rollup_win32_x64_msvc_4.45.1.tgz";
      path = fetchurl {
        name = "_rollup_rollup_win32_x64_msvc___rollup_win32_x64_msvc_4.45.1.tgz";
        url  = "https://registry.yarnpkg.com/@rollup/rollup-win32-x64-msvc/-/rollup-win32-x64-msvc-4.45.1.tgz";
        sha512 = "M/fKi4sasCdM8i0aWJjCSFm2qEnYRR8AMLG2kxp6wD13+tMGA4Z1tVAuHkNRjud5SW2EM3naLuK35w9twvf6aA==";
      };
    }
    {
      name = "_types_babel__core___babel__core_7.20.5.tgz";
      path = fetchurl {
        name = "_types_babel__core___babel__core_7.20.5.tgz";
        url  = "https://registry.yarnpkg.com/@types/babel__core/-/babel__core-7.20.5.tgz";
        sha512 = "qoQprZvz5wQFJwMDqeseRXWv3rqMvhgpbXFfVyWhbx9X47POIA6i/+dXefEmZKoAgOaTdaIgNSMqMIU61yRyzA==";
      };
    }
    {
      name = "_types_babel__generator___babel__generator_7.27.0.tgz";
      path = fetchurl {
        name = "_types_babel__generator___babel__generator_7.27.0.tgz";
        url  = "https://registry.yarnpkg.com/@types/babel__generator/-/babel__generator-7.27.0.tgz";
        sha512 = "ufFd2Xi92OAVPYsy+P4n7/U7e68fex0+Ee8gSG9KX7eo084CWiQ4sdxktvdl0bOPupXtVJPY19zk6EwWqUQ8lg==";
      };
    }
    {
      name = "_types_babel__template___babel__template_7.4.4.tgz";
      path = fetchurl {
        name = "_types_babel__template___babel__template_7.4.4.tgz";
        url  = "https://registry.yarnpkg.com/@types/babel__template/-/babel__template-7.4.4.tgz";
        sha512 = "h/NUaSyG5EyxBIp8YRxo4RMe2/qQgvyowRwVMzhYhBCONbW8PUsg4lkFMrhgZhUe5z3L3MiLDuvyJ/CaPa2A8A==";
      };
    }
    {
      name = "_types_babel__traverse___babel__traverse_7.20.7.tgz";
      path = fetchurl {
        name = "_types_babel__traverse___babel__traverse_7.20.7.tgz";
        url  = "https://registry.yarnpkg.com/@types/babel__traverse/-/babel__traverse-7.20.7.tgz";
        sha512 = "dkO5fhS7+/oos4ciWxyEyjWe48zmG6wbCheo/G2ZnHx4fs3EU6YC6UM8rk56gAjNJ9P3MTH2jo5jb92/K6wbng==";
      };
    }
    {
      name = "_types_estree___estree_1.0.8.tgz";
      path = fetchurl {
        name = "_types_estree___estree_1.0.8.tgz";
        url  = "https://registry.yarnpkg.com/@types/estree/-/estree-1.0.8.tgz";
        sha512 = "dWHzHa2WqEXI/O1E9OjrocMTKJl2mSrEolh1Iomrv6U+JuNwaHXsXx9bLu5gG7BUWFIN0skIQJQ/L1rIex4X6w==";
      };
    }
    {
      name = "_types_history___history_4.7.11.tgz";
      path = fetchurl {
        name = "_types_history___history_4.7.11.tgz";
        url  = "https://registry.yarnpkg.com/@types/history/-/history-4.7.11.tgz";
        sha512 = "qjDJRrmvBMiTx+jyLxvLfJU7UznFuokDv4f3WRuriHKERccVpFU+8XMQUAbDzoiJCsmexxRExQeMwwCdamSKDA==";
      };
    }
    {
      name = "_types_lodash___lodash_4.17.20.tgz";
      path = fetchurl {
        name = "_types_lodash___lodash_4.17.20.tgz";
        url  = "https://registry.yarnpkg.com/@types/lodash/-/lodash-4.17.20.tgz";
        sha512 = "H3MHACvFUEiujabxhaI/ImO6gUrd8oOurg7LQtS7mbwIXA/cUqWrvBsaeJ23aZEPk1TAYkurjfMbSELfoCXlGA==";
      };
    }
    {
      name = "_types_react_dom___react_dom_19.1.6.tgz";
      path = fetchurl {
        name = "_types_react_dom___react_dom_19.1.6.tgz";
        url  = "https://registry.yarnpkg.com/@types/react-dom/-/react-dom-19.1.6.tgz";
        sha512 = "4hOiT/dwO8Ko0gV1m/TJZYk3y0KBnY9vzDh7W+DH17b2HFSOGgdj33dhihPeuy3l0q23+4e+hoXHV6hCC4dCXw==";
      };
    }
    {
      name = "_types_react_router_dom___react_router_dom_5.3.3.tgz";
      path = fetchurl {
        name = "_types_react_router_dom___react_router_dom_5.3.3.tgz";
        url  = "https://registry.yarnpkg.com/@types/react-router-dom/-/react-router-dom-5.3.3.tgz";
        sha512 = "kpqnYK4wcdm5UaWI3fLcELopqLrHgLqNsdpHauzlQktfkHL3npOSwtj1Uz9oKBAzs7lFtVkV8j83voAz2D8fhw==";
      };
    }
    {
      name = "_types_react_router___react_router_5.1.20.tgz";
      path = fetchurl {
        name = "_types_react_router___react_router_5.1.20.tgz";
        url  = "https://registry.yarnpkg.com/@types/react-router/-/react-router-5.1.20.tgz";
        sha512 = "jGjmu/ZqS7FjSH6owMcD5qpq19+1RS9DeVRqfl1FeBMxTDQAGwlMWOcs52NDoXaNKyG3d1cYQFMs9rCrb88o9Q==";
      };
    }
    {
      name = "_types_react___react_19.1.8.tgz";
      path = fetchurl {
        name = "_types_react___react_19.1.8.tgz";
        url  = "https://registry.yarnpkg.com/@types/react/-/react-19.1.8.tgz";
        sha512 = "AwAfQ2Wa5bCx9WP8nZL2uMZWod7J7/JSplxbTmBQ5ms6QpqNYm672H0Vu9ZVKVngQ+ii4R/byguVEUZQyeg44g==";
      };
    }
    {
      name = "_vitejs_plugin_react___plugin_react_4.7.0.tgz";
      path = fetchurl {
        name = "_vitejs_plugin_react___plugin_react_4.7.0.tgz";
        url  = "https://registry.yarnpkg.com/@vitejs/plugin-react/-/plugin-react-4.7.0.tgz";
        sha512 = "gUu9hwfWvvEDBBmgtAowQCojwZmJ5mcLn3aufeCsitijs3+f2NsrPtlAWIR6OPiqljl96GVCUbLe0HyqIpVaoA==";
      };
    }
    {
      name = "browserslist___browserslist_4.25.1.tgz";
      path = fetchurl {
        name = "browserslist___browserslist_4.25.1.tgz";
        url  = "https://registry.yarnpkg.com/browserslist/-/browserslist-4.25.1.tgz";
        sha512 = "KGj0KoOMXLpSNkkEI6Z6mShmQy0bc1I+T7K9N81k4WWMrfz+6fQ6es80B/YLAeRoKvjYE1YSHHOW1qe9xIVzHw==";
      };
    }
    {
      name = "caniuse_lite___caniuse_lite_1.0.30001727.tgz";
      path = fetchurl {
        name = "caniuse_lite___caniuse_lite_1.0.30001727.tgz";
        url  = "https://registry.yarnpkg.com/caniuse-lite/-/caniuse-lite-1.0.30001727.tgz";
        sha512 = "pB68nIHmbN6L/4C6MH1DokyR3bYqFwjaSs/sWDHGj4CTcFtQUQMuJftVwWkXq7mNWOybD3KhUv3oWHoGxgP14Q==";
      };
    }
    {
      name = "convert_source_map___convert_source_map_2.0.0.tgz";
      path = fetchurl {
        name = "convert_source_map___convert_source_map_2.0.0.tgz";
        url  = "https://registry.yarnpkg.com/convert-source-map/-/convert-source-map-2.0.0.tgz";
        sha512 = "Kvp459HrV2FEJ1CAsi1Ku+MY3kasH19TFykTz2xWmMeq6bk2NU3XXvfJ+Q61m0xktWwt+1HSYf3JZsTms3aRJg==";
      };
    }
    {
      name = "cookie___cookie_1.0.2.tgz";
      path = fetchurl {
        name = "cookie___cookie_1.0.2.tgz";
        url  = "https://registry.yarnpkg.com/cookie/-/cookie-1.0.2.tgz";
        sha512 = "9Kr/j4O16ISv8zBBhJoi4bXOYNTkFLOqSL3UDB0njXxCXNezjeyVrJyGOWtgfs/q2km1gwBcfH8q1yEGoMYunA==";
      };
    }
    {
      name = "csstype___csstype_3.1.3.tgz";
      path = fetchurl {
        name = "csstype___csstype_3.1.3.tgz";
        url  = "https://registry.yarnpkg.com/csstype/-/csstype-3.1.3.tgz";
        sha512 = "M1uQkMl8rQK/szD0LNhtqxIPLpimGm8sOBwU7lLnCpSbTyY3yeU1Vc7l4KT5zT4s/yOxHH5O7tIuuLOCnLADRw==";
      };
    }
    {
      name = "debug___debug_4.4.1.tgz";
      path = fetchurl {
        name = "debug___debug_4.4.1.tgz";
        url  = "https://registry.yarnpkg.com/debug/-/debug-4.4.1.tgz";
        sha512 = "KcKCqiftBJcZr++7ykoDIEwSa3XWowTfNPo92BYxjXiyYEVrUQh2aLyhxBCwww+heortUFxEJYcRzosstTEBYQ==";
      };
    }
    {
      name = "electron_to_chromium___electron_to_chromium_1.5.187.tgz";
      path = fetchurl {
        name = "electron_to_chromium___electron_to_chromium_1.5.187.tgz";
        url  = "https://registry.yarnpkg.com/electron-to-chromium/-/electron-to-chromium-1.5.187.tgz";
        sha512 = "cl5Jc9I0KGUoOoSbxvTywTa40uspGJt/BDBoDLoxJRSBpWh4FFXBsjNRHfQrONsV/OoEjDfHUmZQa2d6Ze4YgA==";
      };
    }
    {
      name = "esbuild___esbuild_0.25.7.tgz";
      path = fetchurl {
        name = "esbuild___esbuild_0.25.7.tgz";
        url  = "https://registry.yarnpkg.com/esbuild/-/esbuild-0.25.7.tgz";
        sha512 = "daJB0q2dmTzo90L9NjRaohhRWrCzYxWNFTjEi72/h+p5DcY3yn4MacWfDakHmaBaDzDiuLJsCh0+6LK/iX+c+Q==";
      };
    }
    {
      name = "escalade___escalade_3.2.0.tgz";
      path = fetchurl {
        name = "escalade___escalade_3.2.0.tgz";
        url  = "https://registry.yarnpkg.com/escalade/-/escalade-3.2.0.tgz";
        sha512 = "WUj2qlxaQtO4g6Pq5c29GTcWGDyd8itL8zTlipgECz3JesAiiOKotd8JU6otB3PACgG6xkJUyVhboMS+bje/jA==";
      };
    }
    {
      name = "fdir___fdir_6.4.6.tgz";
      path = fetchurl {
        name = "fdir___fdir_6.4.6.tgz";
        url  = "https://registry.yarnpkg.com/fdir/-/fdir-6.4.6.tgz";
        sha512 = "hiFoqpyZcfNm1yc4u8oWCf9A2c4D3QjCrks3zmoVKVxpQRzmPNar1hUJcBG2RQHvEVGDN+Jm81ZheVLAQMK6+w==";
      };
    }
    {
      name = "fsevents___fsevents_2.3.3.tgz";
      path = fetchurl {
        name = "fsevents___fsevents_2.3.3.tgz";
        url  = "https://registry.yarnpkg.com/fsevents/-/fsevents-2.3.3.tgz";
        sha512 = "5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw==";
      };
    }
    {
      name = "gensync___gensync_1.0.0_beta.2.tgz";
      path = fetchurl {
        name = "gensync___gensync_1.0.0_beta.2.tgz";
        url  = "https://registry.yarnpkg.com/gensync/-/gensync-1.0.0-beta.2.tgz";
        sha512 = "3hN7NaskYvMDLQY55gnW3NQ+mesEAepTqlg+VEbj7zzqEMBVNhzcGYYeqFo/TlYz6eQiFcp1HcsCZO+nGgS8zg==";
      };
    }
    {
      name = "js_tokens___js_tokens_4.0.0.tgz";
      path = fetchurl {
        name = "js_tokens___js_tokens_4.0.0.tgz";
        url  = "https://registry.yarnpkg.com/js-tokens/-/js-tokens-4.0.0.tgz";
        sha512 = "RdJUflcE3cUzKiMqQgsCu06FPu9UdIJO0beYbPhHN4k6apgJtifcoCtT9bcxOpYBtpD2kCM6Sbzg4CausW/PKQ==";
      };
    }
    {
      name = "jsesc___jsesc_3.1.0.tgz";
      path = fetchurl {
        name = "jsesc___jsesc_3.1.0.tgz";
        url  = "https://registry.yarnpkg.com/jsesc/-/jsesc-3.1.0.tgz";
        sha512 = "/sM3dO2FOzXjKQhJuo0Q173wf2KOo8t4I8vHy6lF9poUp7bKT0/NHE8fPX23PwfhnykfqnC2xRxOnVw5XuGIaA==";
      };
    }
    {
      name = "json5___json5_2.2.3.tgz";
      path = fetchurl {
        name = "json5___json5_2.2.3.tgz";
        url  = "https://registry.yarnpkg.com/json5/-/json5-2.2.3.tgz";
        sha512 = "XmOWe7eyHYH14cLdVPoyg+GOH3rYX++KpzrylJwSW98t3Nk+U8XOl8FWKOgwtzdb8lXGf6zYwDUzeHMWfxasyg==";
      };
    }
    {
      name = "lodash___lodash_4.17.21.tgz";
      path = fetchurl {
        name = "lodash___lodash_4.17.21.tgz";
        url  = "https://registry.yarnpkg.com/lodash/-/lodash-4.17.21.tgz";
        sha512 = "v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg==";
      };
    }
    {
      name = "lru_cache___lru_cache_5.1.1.tgz";
      path = fetchurl {
        name = "lru_cache___lru_cache_5.1.1.tgz";
        url  = "https://registry.yarnpkg.com/lru-cache/-/lru-cache-5.1.1.tgz";
        sha512 = "KpNARQA3Iwv+jTA0utUVVbrh+Jlrr1Fv0e56GGzAFOXN7dk/FviaDW8LHmK52DlcH4WP2n6gI8vN1aesBFgo9w==";
      };
    }
    {
      name = "ms___ms_2.1.3.tgz";
      path = fetchurl {
        name = "ms___ms_2.1.3.tgz";
        url  = "https://registry.yarnpkg.com/ms/-/ms-2.1.3.tgz";
        sha512 = "6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==";
      };
    }
    {
      name = "nanoid___nanoid_3.3.11.tgz";
      path = fetchurl {
        name = "nanoid___nanoid_3.3.11.tgz";
        url  = "https://registry.yarnpkg.com/nanoid/-/nanoid-3.3.11.tgz";
        sha512 = "N8SpfPUnUp1bK+PMYW8qSWdl9U+wwNWI4QKxOYDy9JAro3WMX7p2OeVRF9v+347pnakNevPmiHhNmZ2HbFA76w==";
      };
    }
    {
      name = "node_releases___node_releases_2.0.19.tgz";
      path = fetchurl {
        name = "node_releases___node_releases_2.0.19.tgz";
        url  = "https://registry.yarnpkg.com/node-releases/-/node-releases-2.0.19.tgz";
        sha512 = "xxOWJsBKtzAq7DY0J+DTzuz58K8e7sJbdgwkbMWQe8UYB6ekmsQ45q0M/tJDsGaZmbC+l7n57UV8Hl5tHxO9uw==";
      };
    }
    {
      name = "picocolors___picocolors_1.1.1.tgz";
      path = fetchurl {
        name = "picocolors___picocolors_1.1.1.tgz";
        url  = "https://registry.yarnpkg.com/picocolors/-/picocolors-1.1.1.tgz";
        sha512 = "xceH2snhtb5M9liqDsmEw56le376mTZkEX/jEb/RxNFyegNul7eNslCXP9FDj/Lcu0X8KEyMceP2ntpaHrDEVA==";
      };
    }
    {
      name = "picomatch___picomatch_4.0.3.tgz";
      path = fetchurl {
        name = "picomatch___picomatch_4.0.3.tgz";
        url  = "https://registry.yarnpkg.com/picomatch/-/picomatch-4.0.3.tgz";
        sha512 = "5gTmgEY/sqK6gFXLIsQNH19lWb4ebPDLA4SdLP7dsWkIXHWlG66oPuVvXSGFPppYZz8ZDZq0dYYrbHfBCVUb1Q==";
      };
    }
    {
      name = "postcss___postcss_8.5.6.tgz";
      path = fetchurl {
        name = "postcss___postcss_8.5.6.tgz";
        url  = "https://registry.yarnpkg.com/postcss/-/postcss-8.5.6.tgz";
        sha512 = "3Ybi1tAuwAP9s0r1UQ2J4n5Y0G05bJkpUIO0/bI9MhwmD70S5aTWbXGBwxHrelT+XM1k6dM0pk+SwNkpTRN7Pg==";
      };
    }
    {
      name = "react_dom___react_dom_19.1.0.tgz";
      path = fetchurl {
        name = "react_dom___react_dom_19.1.0.tgz";
        url  = "https://registry.yarnpkg.com/react-dom/-/react-dom-19.1.0.tgz";
        sha512 = "Xs1hdnE+DyKgeHJeJznQmYMIBG3TKIHJJT95Q58nHLSrElKlGQqDTR2HQ9fx5CN/Gk6Vh/kupBTDLU11/nDk/g==";
      };
    }
    {
      name = "react_refresh___react_refresh_0.17.0.tgz";
      path = fetchurl {
        name = "react_refresh___react_refresh_0.17.0.tgz";
        url  = "https://registry.yarnpkg.com/react-refresh/-/react-refresh-0.17.0.tgz";
        sha512 = "z6F7K9bV85EfseRCp2bzrpyQ0Gkw1uLoCel9XBVWPg/TjRj94SkJzUTGfOa4bs7iJvBWtQG0Wq7wnI0syw3EBQ==";
      };
    }
    {
      name = "react_router_dom___react_router_dom_7.7.0.tgz";
      path = fetchurl {
        name = "react_router_dom___react_router_dom_7.7.0.tgz";
        url  = "https://registry.yarnpkg.com/react-router-dom/-/react-router-dom-7.7.0.tgz";
        sha512 = "wwGS19VkNBkneVh9/YD0pK3IsjWxQUVMDD6drlG7eJpo1rXBtctBqDyBm/k+oKHRAm1x9XWT3JFC82QI9YOXXA==";
      };
    }
    {
      name = "react_router___react_router_7.7.0.tgz";
      path = fetchurl {
        name = "react_router___react_router_7.7.0.tgz";
        url  = "https://registry.yarnpkg.com/react-router/-/react-router-7.7.0.tgz";
        sha512 = "3FUYSwlvB/5wRJVTL/aavqHmfUKe0+Xm9MllkYgGo9eDwNdkvwlJGjpPxono1kCycLt6AnDTgjmXvK3/B4QGuw==";
      };
    }
    {
      name = "react___react_19.1.0.tgz";
      path = fetchurl {
        name = "react___react_19.1.0.tgz";
        url  = "https://registry.yarnpkg.com/react/-/react-19.1.0.tgz";
        sha512 = "FS+XFBNvn3GTAWq26joslQgWNoFu08F4kl0J4CgdNKADkdSGXQyTCnKteIAJy96Br6YbpEU1LSzV5dYtjMkMDg==";
      };
    }
    {
      name = "rollup___rollup_4.45.1.tgz";
      path = fetchurl {
        name = "rollup___rollup_4.45.1.tgz";
        url  = "https://registry.yarnpkg.com/rollup/-/rollup-4.45.1.tgz";
        sha512 = "4iya7Jb76fVpQyLoiVpzUrsjQ12r3dM7fIVz+4NwoYvZOShknRmiv+iu9CClZml5ZLGb0XMcYLutK6w9tgxHDw==";
      };
    }
    {
      name = "scheduler___scheduler_0.26.0.tgz";
      path = fetchurl {
        name = "scheduler___scheduler_0.26.0.tgz";
        url  = "https://registry.yarnpkg.com/scheduler/-/scheduler-0.26.0.tgz";
        sha512 = "NlHwttCI/l5gCPR3D1nNXtWABUmBwvZpEQiD4IXSbIDq8BzLIK/7Ir5gTFSGZDUu37K5cMNp0hFtzO38sC7gWA==";
      };
    }
    {
      name = "semver___semver_6.3.1.tgz";
      path = fetchurl {
        name = "semver___semver_6.3.1.tgz";
        url  = "https://registry.yarnpkg.com/semver/-/semver-6.3.1.tgz";
        sha512 = "BR7VvDCVHO+q2xBEWskxS6DJE1qRnb7DxzUrogb71CWoSficBxYsiAGd+Kl0mmq/MprG9yArRkyrQxTO6XjMzA==";
      };
    }
    {
      name = "set_cookie_parser___set_cookie_parser_2.7.1.tgz";
      path = fetchurl {
        name = "set_cookie_parser___set_cookie_parser_2.7.1.tgz";
        url  = "https://registry.yarnpkg.com/set-cookie-parser/-/set-cookie-parser-2.7.1.tgz";
        sha512 = "IOc8uWeOZgnb3ptbCURJWNjWUPcO3ZnTTdzsurqERrP6nPyv+paC55vJM0LpOlT2ne+Ix+9+CRG1MNLlyZ4GjQ==";
      };
    }
    {
      name = "source_map_js___source_map_js_1.2.1.tgz";
      path = fetchurl {
        name = "source_map_js___source_map_js_1.2.1.tgz";
        url  = "https://registry.yarnpkg.com/source-map-js/-/source-map-js-1.2.1.tgz";
        sha512 = "UXWMKhLOwVKb728IUtQPXxfYU+usdybtUrK/8uGE8CQMvrhOpwvzDBwj0QhSL7MQc7vIsISBG8VQ8+IDQxpfQA==";
      };
    }
    {
      name = "tinyglobby___tinyglobby_0.2.14.tgz";
      path = fetchurl {
        name = "tinyglobby___tinyglobby_0.2.14.tgz";
        url  = "https://registry.yarnpkg.com/tinyglobby/-/tinyglobby-0.2.14.tgz";
        sha512 = "tX5e7OM1HnYr2+a2C/4V0htOcSQcoSTH9KgJnVvNm5zm/cyEWKJ7j7YutsH9CxMdtOkkLFy2AHrMci9IM8IPZQ==";
      };
    }
    {
      name = "typescript___typescript_5.8.3.tgz";
      path = fetchurl {
        name = "typescript___typescript_5.8.3.tgz";
        url  = "https://registry.yarnpkg.com/typescript/-/typescript-5.8.3.tgz";
        sha512 = "p1diW6TqL9L07nNxvRMM7hMMw4c5XOo/1ibL4aAIGmSAt9slTE1Xgw5KWuof2uTOvCg9BY7ZRi+GaF+7sfgPeQ==";
      };
    }
    {
      name = "update_browserslist_db___update_browserslist_db_1.1.3.tgz";
      path = fetchurl {
        name = "update_browserslist_db___update_browserslist_db_1.1.3.tgz";
        url  = "https://registry.yarnpkg.com/update-browserslist-db/-/update-browserslist-db-1.1.3.tgz";
        sha512 = "UxhIZQ+QInVdunkDAaiazvvT/+fXL5Osr0JZlJulepYu6Jd7qJtDZjlur0emRlT71EN3ScPoE7gvsuIKKNavKw==";
      };
    }
    {
      name = "vite___vite_7.0.5.tgz";
      path = fetchurl {
        name = "vite___vite_7.0.5.tgz";
        url  = "https://registry.yarnpkg.com/vite/-/vite-7.0.5.tgz";
        sha512 = "1mncVwJxy2C9ThLwz0+2GKZyEXuC3MyWtAAlNftlZZXZDP3AJt5FmwcMit/IGGaNZ8ZOB2BNO/HFUB+CpN0NQw==";
      };
    }
    {
      name = "yallist___yallist_3.1.1.tgz";
      path = fetchurl {
        name = "yallist___yallist_3.1.1.tgz";
        url  = "https://registry.yarnpkg.com/yallist/-/yallist-3.1.1.tgz";
        sha512 = "a4UGQaWPH59mOXUYnAG2ewncQS4i4F43Tv3JoAM+s2VDAmS9NsK8GpDMLrCHPksFT7h3K6TOoUNn2pb7RoXx4g==";
      };
    }
  ];
}
