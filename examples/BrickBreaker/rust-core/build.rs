use std::env;
use std::path::PathBuf;

fn main() {
    let crate_dir = PathBuf::from(
        env::var("CARGO_MANIFEST_DIR")
            .expect("CARGO_MANIFEST_DIR is not set"),
    );

    let package_name = env::var("CARGO_PKG_NAME")
        .expect("CARGO_PKG_NAME is not set")
        .replace('-', "_");

    let output_file = crate_dir
        .join("include")
        .join(format!("{package_name}.h"));

    std::fs::create_dir_all(
        output_file.parent().expect("Header path has no parent directory"),
    )
    .expect("Could not create the include directory");

    let config_path = crate_dir.join("cbindgen.toml");
    let config = cbindgen::Config::from_file(&config_path)
        .unwrap_or_default();

    cbindgen::Builder::new()
        .with_crate(&crate_dir)
        .with_config(config)
        .generate()
        .expect("Unable to generate C bindings")
        .write_to_file(output_file);
}

