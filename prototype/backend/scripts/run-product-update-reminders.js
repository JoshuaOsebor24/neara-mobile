require("dotenv").config();

const { sendProductUpdateReminders } = require("../services/reminder-jobs");

async function main() {
  const result = await sendProductUpdateReminders();
  console.log(
    JSON.stringify(
      {
        candidatesEvaluated: result.candidatesEvaluated,
        results: result.results,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Failed to run product reminder job", {
    message: error?.message || String(error),
    stack: error?.stack,
  });
  process.exit(1);
});
