// @ts-ignore
import BareMux from "@mercuryworkshop/bare-mux";

// will register /sw.js and setup bare mux
// reloads the page to activate the sw.js if it wasn't registered
export async function setupServiceWorker() {
  if (
    location.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(location.hostname)
  )
    throw new Error("HTTPS must be enabled to use Ultraviolet.");

  if (!navigator.serviceWorker)
    throw new Error("Your browser doesn't support service workers.");

  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) {
    await navigator.serviceWorker.ready;
    console.log("Service worker registered");
  } else {
    await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    console.log("Service worker registered");
    console.log("Reloading the page to activate it.");
    location.reload();
    return;
  }

  console.log("Using wisp at", window.wisp_api);
  await BareMux.SetTransport("EpxMod.EpoxyClient", {
    wisp: window.wisp_api,
  });
}
