import type { Config } from "tailwindcss"

const config = {
  //... your existing config
  plugins: [
    require("@tailwindcss/typography"), // <-- Ensure this line is present
  ],
} satisfies Config

export default config