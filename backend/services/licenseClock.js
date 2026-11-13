// ============================================================
// СОАТНИ ОРҚАГА СУРИШДАН ҲИМОЯ
//
// Лицензия муддати интернетсиз локал базадан текширилади. Компьютер
// соатини орқага суриб муддатни алдаш мумкин бўлмаслиги учун дастур
// "охирги кўрилган вақт"ни (lastSeenAt) сақлаб боради: у фақат олдинга
// силжийди. Соат ундан орқада бўлса, интернетсиз кириш тўхтатилади.
// ============================================================

const LocalUser = require("../models/localUser");

// Ёзги/қишки вақт ва соатни тўғрилаш каби кичик фарқлар учун
const CLOCK_TOLERANCE_MS = 10 * 60 * 1000;

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

// options.reset — сервер лицензияни тасдиқлаганда: белги ҳозирги вақтга
// қайта ўрнатилади (соат адашиб олдинга сурилган бўлса ҳам тикланади).
async function touchLastSeen(localUser, options = {}) {
  try {
    const user =
      localUser || (await LocalUser.findOne());

    if (!user) {
      return;
    }

    const now = Date.now();

    const lastSeen = user.lastSeenAt
      ? new Date(user.lastSeenAt).getTime()
      : 0;

    if (options.reset || now > lastSeen) {
      await user.update({
        lastSeenAt: new Date(now),
      });
    }
  } catch (error) {
    console.error(
      "[LICENSE] lastSeenAt update error:",
      error.message
    );
  }
}

// Дастур ишлаб турганда вақт белгисини олдинга суриб боради
function startClockHeartbeat() {
  setInterval(() => {
    touchLastSeen();
  }, HEARTBEAT_INTERVAL_MS).unref();
}

module.exports = {
  CLOCK_TOLERANCE_MS,
  touchLastSeen,
  startClockHeartbeat,
};
