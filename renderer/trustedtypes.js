if (window.trustedTypes) {
    window.trustedTypes.createPolicy('default', {
      createScript: (input) => input
    });
  }