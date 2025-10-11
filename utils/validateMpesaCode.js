function validateMpesaCode(code) {
  if (typeof code !== "string") return false;
  const c = code.toUpperCase();
  if (c.length !== 10) return false;
  if (!/^[A-Z1-9]{10}$/.test(c)) return false;
  const digits = c.split("").filter((ch) => /[1-9]/.test(ch)).length;
  const letters = c.split("").filter((ch) => /[A-Z]/.test(ch)).length;
  return digits === 3 && letters === 7;
}
module.exports = { validateMpesaCode };
