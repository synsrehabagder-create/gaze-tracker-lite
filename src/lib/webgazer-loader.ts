// WebGazer loader utility
let webgazerPromise: Promise<any> | null = null;

export function loadWebGazer(): Promise<any> {
  if (webgazerPromise) return webgazerPromise;

  webgazerPromise = new Promise((resolve, reject) => {
    if ((window as any).webgazer) {
      resolve((window as any).webgazer);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://webgazer.cs.brown.edu/webgazer.js";
    script.async = true;
    script.onload = () => {
      const wg = (window as any).webgazer;
      if (wg) {
        resolve(wg);
      } else {
        reject(new Error("WebGazer failed to initialize"));
      }
    };
    script.onerror = () => reject(new Error("Failed to load WebGazer script"));
    document.head.appendChild(script);
  });

  return webgazerPromise;
}
