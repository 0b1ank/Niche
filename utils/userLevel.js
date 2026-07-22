function getUserLevel(postCount) {
  if (postCount >= 5) {
    return {
      level: 3,
      title: "Chief Caffeine Officer 👑",
      badgeClass: "badge-level-3"
    };
  } else if (postCount >= 3) {
    return {
      level: 2,
      title: "Oat Milk Evangelist 🌾",
      badgeClass: "badge-level-2"
    };
  } else if (postCount >= 1) {
    return {
      level: 1,
      title: "Espresso Novice ☕",
      badgeClass: "badge-level-1"
    };
  } else {
    return {
      level: 0,
      title: "Window Shopper 🪟",
      badgeClass: "badge-level-0"
    };
  }
}

module.exports = { getUserLevel };