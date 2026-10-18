#[unsafe(no_mangle)]
pub extern "C" fn oxide_add(left: f64, right: f64) -> f64 {
    left + right
}
