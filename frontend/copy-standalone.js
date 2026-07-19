const fs = require("fs");
const path = require("path");

const root = __dirname;

const standaloneDir = path.join(
  root,
  ".next",
  "standalone"
);

const staticSource = path.join(
  root,
  ".next",
  "static"
);

const staticDestination = path.join(
  standaloneDir,
  ".next",
  "static"
);

const publicSource = path.join(
  root,
  "public"
);

const publicDestination = path.join(
  standaloneDir,
  "public"
);

function copyDirectory(source, destination) {
  if (!fs.existsSync(source)) {
    console.log(`SKIP: ${source}`);
    return;
  }

  fs.mkdirSync(destination, {
    recursive: true,
  });

  fs.cpSync(source, destination, {
    recursive: true,
    force: true,
  });

  console.log(
    `COPIED: ${source} -> ${destination}`
  );
}

if (!fs.existsSync(standaloneDir)) {
  throw new Error(
    `Standalone papka topilmadi: ${standaloneDir}`
  );
}

copyDirectory(
  staticSource,
  staticDestination
);

copyDirectory(
  publicSource,
  publicDestination
);

console.log(
  "Next.js standalone files prepared successfully"
);