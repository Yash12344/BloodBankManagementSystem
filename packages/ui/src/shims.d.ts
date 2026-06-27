// tailwindcss-animate ships no type declarations; declare it as a Tailwind plugin module.
declare module "tailwindcss-animate" {
  import type { PluginCreator } from "tailwindcss/types/config";
  const plugin: PluginCreator;
  export default plugin;
}
