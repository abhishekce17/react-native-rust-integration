#[unsafe(no_mangle)]
pub extern "C" fn run_loop(i: f64) -> f64 {
    let mut sum = 0.0;
    let limit = i as u64;

    // Actual summation of 1 + 2 + 3 + ... + limit over all iterations
    for k in 1..=limit {
        sum += k as f64;
    }

    sum
}
