//!This module contains functions to retrieve differente analysis data to be used in the API.
pub mod api;
pub mod methods;

// On the javascript side, we need to compress some big floats into the range of small integers
// Maps a value from the range [0, 1T] to a range of small int: -32768 to 32767
// function encode_float_to_u16(value: number | bigint): number {
//     const MAX_INPUT = 1_000_000_000_000;
//     const U16_MAX = 65535;
//     if(value > MAX_INPUT) {
//         value = MAX_INPUT;
//     } else if(value < 0) {
//         console.log("[warn] Cannot encode negative value to u16, setting to 0");
//         value = 0;
//     }
//     if (typeof value === "bigint") {
//         value = Number(value);
//     }
//     const log_max = Math.log10(MAX_INPUT + 1);
//     const log_value = Math.log10(value + 1);
//     return Math.round((log_value / log_max) * U16_MAX);
// }
//
// function turn_u16_to_i16(value: number): number {
//     return value - 32768;
// }
//
// function compress_value_for_db(value: number | bigint): number {
//     return turn_u16_to_i16(encode_float_to_u16(value));
// }

pub fn decompress_value_from_db(value: i16) -> u64 {
    let encoded = ((value as i32) + 32768) as u16;
    let max_input_log = (1_000_000_000_000u64 as f64 + 1.0).log10();
    let norm = encoded as f64 / 65535.0;

    (10f64.powf(norm * max_input_log) - 1.0).round() as u64
}

#[cfg(test)]
mod test {
    use super::*;

    // `Value: ${v}, Encoded: ${encode_float_to_u16(v)}, Compressed: ${compress_value_for_db(v)}`
    // Value: 0, Encoded: 0, Compressed: -32768
    // Value: 1, Encoded: 1644, Compressed: -31124
    // Value: 10, Encoded: 5687, Compressed: -27081
    // Value: 100, Encoded: 10946, Compressed: -21822
    // Value: 1000, Encoded: 16386, Compressed: -16382
    // Value: 100000, Encoded: 27306, Compressed: -5462
    // Value: 5000000, Encoded: 36585, Compressed: 3817
    // Value: 1000000000, Encoded: 49151, Compressed: 16383
    #[test]
    fn test_decompress_value_from_db() {
        let within_1percent = |a: u64, b: u64| {
            let diff = if a > b { a - b } else { b - a };
            diff <= (a / 100) // 1% tolerance
        };
        //assert_eq!(decompress_value_from_db(-32768), 0);
        assert!(within_1percent(decompress_value_from_db(-27081), 10));
        assert!(within_1percent(decompress_value_from_db(-21822), 100));
        assert!(within_1percent(decompress_value_from_db(-16382), 1000));
        assert!(within_1percent(decompress_value_from_db(-5462), 100_000));
        assert!(within_1percent(decompress_value_from_db(3817), 5_000_000));
        assert!(within_1percent(
            decompress_value_from_db(16383),
            1_000_000_000
        ));
    }
}
