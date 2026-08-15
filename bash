# 1. Install wasm-pack if not available
cargo install wasm-pack

# 2. Build the WASM output targeted for browser integration
cd crates/web4lang-core
wasm-pack build --target web --out-dir ../../js/pkg
npm install
npx tsc
