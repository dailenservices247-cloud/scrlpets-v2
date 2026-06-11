import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
  const locale = "en"; // cookie/profile-driven switch = later slice; ES ships dictionary-complete (G4-A)
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
