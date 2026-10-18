use std::env;
use std::path::PathBuf;

fn main() {
    let crate_dir = env::var("CARGO_MANIFEST_DIR").unwrap();

    // Reads 'name' from Cargo.toml and turns dashes into underscores (e.g., "oxide-core" -> "oxide_core")
    let pkg_name = env::var("CARGO_PKG_NAME").unwrap().replace('-', "_");

    let output_file = PathBuf::from(&crate_dir)
        .join("include")
        .join(format!("{}.h", pkg_name));

    // Optional: Ensure the include/ directory exists
    let _ = std::fs::create_dir_all(output_file.parent().unwrap());

    // Load cbindgen.toml configuration
    let config = cbindgen::Config::from_file("cbindgen.toml").unwrap_or_default();

    // Generate C header file
    cbindgen::Builder::new()
        .with_crate(&crate_dir)
        .with_config(config)
        .generate()
        .expect("Unable to generate C bindings")
        .write_to_file(output_file);
}
