import React from "react";
import ReactDOM from "react-dom/client";
import "./style.css";

function App() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">StateBase Web</p>
        <h1>Terraform state as a secure infrastructure database.</h1>
        <p>The desktop app is the primary polished UI in this MVP. This web shell is ready to consume the same SDK and backend APIs for a hosted console.</p>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
