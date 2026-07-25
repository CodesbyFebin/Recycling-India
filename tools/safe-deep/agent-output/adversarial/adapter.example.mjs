/**
 * Shape-only adapter example.
 *
 * Copy this file into the application test support directory and replace each
 * method with calls to the real engines/repositories. Do not use this example
 * to claim that the adversarial gate passes.
 */
export async function createHarness() {
  const missing = (name) => async () => {
    throw new Error(`Real SAFE-DEEP adapter method not implemented: ${name}`);
  };
  return {
    recycler: {
      ingest: missing("recycler.ingest"),
      publish: missing("recycler.publish"),
      get: missing("recycler.get")
    },
    pages: {
      propose: missing("pages.propose"),
      publish: missing("pages.publish"),
      get: missing("pages.get")
    },
    prices: {
      ingest: missing("prices.ingest"),
      publish: missing("prices.publish")
    },
    regulations: {
      ingest: missing("regulations.ingest"),
      publish: missing("regulations.publish")
    },
    marketplace: {
      submitListing: missing("marketplace.submitListing"),
      activate: missing("marketplace.activate")
    },
    scoring: { evaluate: missing("scoring.evaluate") },
    agents: {
      issue: missing("agents.issue"),
      write: missing("agents.write")
    },
    a2a: { submit: missing("a2a.submit"), run: missing("a2a.run") },
    completion: { run: missing("completion.run") }
  };
}

