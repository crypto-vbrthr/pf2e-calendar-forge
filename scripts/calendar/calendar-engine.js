function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function floorDiv(value, divisor) {
  return Math.floor(value / divisor);
}

export class CalendarEngine {
  static secondsPerDay(calendar) {
    const time = calendar.time ?? {};
    return (time.secondsPerMinute ?? 60)
      * (time.minutesPerHour ?? 60)
      * (time.hoursPerDay ?? 24);
  }

  static secondsPerHour(calendar) {
    const time = calendar.time ?? {};
    return (time.secondsPerMinute ?? 60) * (time.minutesPerHour ?? 60);
  }

  static secondsPerMinute(calendar) {
    return calendar.time?.secondsPerMinute ?? 60;
  }

  static isLeapYear(year, calendar) {
    const rule = calendar.leapYear ?? { type: "none" };
    if (rule.type === "none") return false;

    if (rule.type === "gregorian") {
      return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    }

    if (rule.type === "interval") {
      const interval = Number(rule.interval ?? 0);
      if (!Number.isFinite(interval) || interval <= 0) return false;
      const offset = Number(rule.offset ?? 0);
      return mod(year - offset, interval) === 0;
    }

    return false;
  }

  static daysInMonth(year, monthIndex, calendar) {
    const month = calendar.months?.[monthIndex];
    if (!month) throw new RangeError(`Unknown month index ${monthIndex}`);
    const base = Number(month.days ?? 0);
    const leap = this.isLeapYear(year, calendar) ? Number(month.leapDays ?? 0) : 0;
    return base + leap;
  }

  static daysInYear(year, calendar) {
    return calendar.months.reduce(
      (sum, _month, index) => sum + this.daysInMonth(year, index, calendar),
      0
    );
  }

  static monthIndex(calendar, monthId) {
    const index = calendar.months.findIndex((month) => month.id === monthId);
    if (index < 0) throw new RangeError(`Unknown month id ${monthId}`);
    return index;
  }

  static dayOfYear(date, calendar) {
    const monthIndex = typeof date.monthIndex === "number"
      ? date.monthIndex
      : this.monthIndex(calendar, date.monthId);

    let ordinal = 0;
    for (let index = 0; index < monthIndex; index += 1) {
      ordinal += this.daysInMonth(date.year, index, calendar);
    }
    ordinal += Number(date.day) - 1;
    return ordinal;
  }

  static dateFromDayOfYear(year, ordinal, calendar) {
    let remaining = ordinal;
    for (let monthIndex = 0; monthIndex < calendar.months.length; monthIndex += 1) {
      const monthDays = this.daysInMonth(year, monthIndex, calendar);
      if (remaining < monthDays) {
        return {
          year,
          monthIndex,
          monthId: calendar.months[monthIndex].id,
          day: remaining + 1
        };
      }
      remaining -= monthDays;
    }
    throw new RangeError(`Ordinal ${ordinal} is outside year ${year}`);
  }

  static validateDate(date, calendar) {
    if (!Number.isInteger(date.year)) throw new TypeError("year must be an integer");
    const monthIndex = typeof date.monthIndex === "number"
      ? date.monthIndex
      : this.monthIndex(calendar, date.monthId);
    if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex >= calendar.months.length) {
      throw new RangeError(`Unknown month index ${monthIndex}`);
    }
    const maxDay = this.daysInMonth(date.year, monthIndex, calendar);
    if (!Number.isInteger(date.day) || date.day < 1 || date.day > maxDay) {
      throw new RangeError(`day must be between 1 and ${maxDay}`);
    }

    const hour = Number(date.hour ?? 0);
    const minute = Number(date.minute ?? 0);
    const second = Number(date.second ?? 0);
    const hoursPerDay = Number(calendar.time?.hoursPerDay ?? 24);
    const minutesPerHour = Number(calendar.time?.minutesPerHour ?? 60);
    const secondsPerMinute = Number(calendar.time?.secondsPerMinute ?? 60);
    if (!Number.isInteger(hour) || hour < 0 || hour >= hoursPerDay) throw new RangeError(`hour must be between 0 and ${hoursPerDay - 1}`);
    if (!Number.isInteger(minute) || minute < 0 || minute >= minutesPerHour) throw new RangeError(`minute must be between 0 and ${minutesPerHour - 1}`);
    if (!Number.isInteger(second) || second < 0 || second >= secondsPerMinute) throw new RangeError(`second must be between 0 and ${secondsPerMinute - 1}`);
    return monthIndex;
  }

  static fromWorldTime(worldTime, calendar, anchor) {
    const secondsPerDay = this.secondsPerDay(calendar);
    const secondsPerHour = this.secondsPerHour(calendar);
    const secondsPerMinute = this.secondsPerMinute(calendar);

    const anchorMonthIndex = this.validateDate(anchor, calendar);
    const anchorTimeSeconds = (anchor.hour ?? 0) * secondsPerHour
      + (anchor.minute ?? 0) * secondsPerMinute
      + (anchor.second ?? 0);

    const deltaSeconds = Number(worldTime) - Number(anchor.worldTime ?? 0);
    const totalSeconds = anchorTimeSeconds + deltaSeconds;
    const dayDelta = floorDiv(totalSeconds, secondsPerDay);
    let timeOfDay = mod(totalSeconds, secondsPerDay);

    let year = anchor.year;
    let ordinal = this.dayOfYear({
      year: anchor.year,
      monthIndex: anchorMonthIndex,
      day: anchor.day
    }, calendar) + dayDelta;

    while (ordinal >= this.daysInYear(year, calendar)) {
      ordinal -= this.daysInYear(year, calendar);
      year += 1;
    }
    while (ordinal < 0) {
      year -= 1;
      ordinal += this.daysInYear(year, calendar);
    }

    const date = this.dateFromDayOfYear(year, ordinal, calendar);
    const hour = Math.floor(timeOfDay / secondsPerHour);
    timeOfDay -= hour * secondsPerHour;
    const minute = Math.floor(timeOfDay / secondsPerMinute);
    const second = timeOfDay - minute * secondsPerMinute;

    const weekLength = calendar.week?.days?.length ?? 0;
    const weekdayIndex = weekLength
      ? mod(Number(anchor.weekdayIndex ?? 0) + dayDelta, weekLength)
      : null;

    return {
      ...date,
      hour,
      minute,
      second,
      weekdayIndex,
      weekdayId: weekdayIndex === null ? null : calendar.week.days[weekdayIndex].id,
      dayOfYear: ordinal + 1,
      yearProgress: this.daysInYear(year, calendar) > 0
        ? ordinal / this.daysInYear(year, calendar)
        : 0,
      worldTime: Number(worldTime)
    };
  }

  static toWorldTime(date, calendar, anchor) {
    const monthIndex = this.validateDate(date, calendar);
    const anchorMonthIndex = this.validateDate(anchor, calendar);

    let dayDelta = 0;
    if (date.year > anchor.year) {
      for (let year = anchor.year; year < date.year; year += 1) {
        dayDelta += this.daysInYear(year, calendar);
      }
    } else if (date.year < anchor.year) {
      for (let year = date.year; year < anchor.year; year += 1) {
        dayDelta -= this.daysInYear(year, calendar);
      }
    }

    dayDelta += this.dayOfYear({ year: date.year, monthIndex, day: date.day }, calendar)
      - this.dayOfYear({ year: anchor.year, monthIndex: anchorMonthIndex, day: anchor.day }, calendar);

    const secondsPerDay = this.secondsPerDay(calendar);
    const secondsPerHour = this.secondsPerHour(calendar);
    const secondsPerMinute = this.secondsPerMinute(calendar);

    const targetTime = (date.hour ?? 0) * secondsPerHour
      + (date.minute ?? 0) * secondsPerMinute
      + (date.second ?? 0);
    const anchorTime = (anchor.hour ?? 0) * secondsPerHour
      + (anchor.minute ?? 0) * secondsPerMinute
      + (anchor.second ?? 0);

    return Number(anchor.worldTime ?? 0)
      + dayDelta * secondsPerDay
      + targetTime
      - anchorTime;
  }

  static shiftMonth(year, monthIndex, amount, calendar) {
    let nextYear = year;
    let nextMonth = monthIndex + amount;
    const count = calendar.months.length;
    while (nextMonth >= count) {
      nextMonth -= count;
      nextYear += 1;
    }
    while (nextMonth < 0) {
      nextMonth += count;
      nextYear -= 1;
    }
    return { year: nextYear, monthIndex: nextMonth, monthId: calendar.months[nextMonth].id };
  }
}
