use std::ffi::{c_char, CStr, CString};
use std::ptr;

// ---------- Stateless examples ----------

#[unsafe(no_mangle)]
pub extern "C" fn rust_add(a: f64, b: f64) -> f64 {
    a + b
}

#[unsafe(no_mangle)]
pub extern "C" fn rust_multiply(a: f64, b: f64) -> f64 {
    a * b
}

#[unsafe(no_mangle)]
pub extern "C" fn rust_is_positive(value: f64) -> bool {
    value > 0.0
}

/// Takes a NUL-terminated UTF-8-compatible C string and returns a newly
/// allocated C string. The caller must release the returned pointer with
/// rust_string_free().
///
/// # Safety
/// `name` must be null or point to a readable NUL-terminated string.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_greeting(name: *const c_char) -> *mut c_char {
    if name.is_null() {
        return ptr::null_mut();
    }

    let name = unsafe { CStr::from_ptr(name) }.to_string_lossy();
    match CString::new(format!("Hello, {name}!")) {
        Ok(value) => value.into_raw(),
        Err(_) => ptr::null_mut(),
    }
}

/// Releases a string returned by rust_greeting().
///
/// # Safety
/// `value` must be null or a pointer returned by rust_greeting(), and it must
/// not have been freed already.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_string_free(value: *mut c_char) {
    if !value.is_null() {
        drop(unsafe { CString::from_raw(value) });
    }
}

// ---------- Optional stateful example ----------

pub struct RustData {
    values: Vec<f32>,
}

#[unsafe(no_mangle)]
pub extern "C" fn rust_data_create(value_count: usize) -> *mut RustData {
    Box::into_raw(Box::new(RustData {
        values: vec![0.0; value_count],
    }))
}

/// Returns true when the index exists; otherwise returns false.
///
/// # Safety
/// `data` must be null or point to a live RustData created by rust_data_create().
#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_data_set(
    data: *mut RustData,
    index: usize,
    value: f32,
) -> bool {
    let Some(data) = (unsafe { data.as_mut() }) else {
        return false;
    };

    let Some(slot) = data.values.get_mut(index) else {
        return false;
    };

    *slot = value;
    true
}

/// Returns a borrowed pointer to Rust-owned memory and writes its element count.
/// The pointer is valid only while `data` remains alive and the vector is not
/// mutated in a way that reallocates it. The C++ example copies it immediately.
///
/// # Safety
/// `data` must be null or point to a live RustData. `out_len` must be null or
/// point to writable memory for one usize.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_data_values(
    data: *const RustData,
    out_len: *mut usize,
) -> *const f32 {
    let Some(data) = (unsafe { data.as_ref() }) else {
        if !out_len.is_null() {
            unsafe { *out_len = 0 };
        }
        return ptr::null();
    };

    if !out_len.is_null() {
        unsafe { *out_len = data.values.len() };
    }

    data.values.as_ptr()
}

/// Destroys a data instance.
///
/// # Safety
/// `data` must be null or a live pointer returned by rust_data_create(), and
/// must not be used or destroyed again after this call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_data_destroy(data: *mut RustData) {
    if !data.is_null() {
        drop(unsafe { Box::from_raw(data) });
    }
}
