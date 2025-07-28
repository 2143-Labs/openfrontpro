import { MAP_FOLDER } from "./Types";
import { compress_value_for_db, decompress_value_from_db, encode_float_to_u16, load_map_data } from "./Util";

let maps = [
    "africa",
    "asia",
    "australia",
    "baikal",
    "betweentwoseas",
    "blacksea",
    "britannia",
    "deglaciatedantarctica",
    "eastasia",
    "europe",
    "europeclassic",
    "falklandislands",
    "faroeislands",
    "gatewaytotheatlantic",
    "giantworldmap",
    "halkidiki",
    "iceland",
    "italia",
    "mars",
    "mena",
    "northamerica",
    "oceania",
    "pangaea",
    "southamerica",
    "straitofgibraltar",
    "world",
];


for(let map of maps) {
    const map_data = await load_map_data(
        MAP_FOLDER!,
        map,
    );
    console.log(`Map ${map_data.manifest.name} = ${map_data.manifest.map.width}x${map_data.manifest.map.height}`);
}

for (let v of [0, 1, 10, 100, 1000, 100_000, 5_000_000, 1_000_000_000, 100_000_000_000]) {
    let compressed = compress_value_for_db(v);
    let decompressed = decompress_value_from_db(compressed);
    let error = Math.abs(Number(decompressed) - Number(v));
    let error_percent = (error / Number(v)) * 100;
    console.log(`Value: ${v}, Encoded: ${encode_float_to_u16(v)}, Compressed: ${compressed}, Decompressed: ${decompressed}, Error: ${error_percent.toFixed(2)}%`);
}

