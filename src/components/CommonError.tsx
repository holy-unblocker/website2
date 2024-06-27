import { themeStyles } from "./ThemeElements";

const CommonError = ({
  cause,
  error,
  message,
}: {
  cause?: string | null;
  error: string;
  message: string;
}) => (
  <main className="error">
    <p>{message}:</p>
    {cause ? (
      <>
        <pre>{cause}</pre>
        <pre>{error}</pre>
      </>
    ) : (
      <pre>{error}</pre>
    )}
    <p>
      <a class={themeStyles.themeLink} href="i:" id="reload">
        Try again by clicking here.
      </a>
      <br />
      If this problem still occurs, check our{" "}
      <a class={themeStyles.themeLink} href="/faq" target="_parent">
        {" "}
        FAQ{" "}
      </a>{" "}
      or{" "}
      <a class={themeStyles.themeLink} href="/contact" target="_parent">
        Contact Us
      </a>
      .
    </p>
  </main>
);

export default CommonError;
