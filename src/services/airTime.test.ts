import {describe, expect, test} from '@jest/globals';
import {parseAirTime} from "./airTimeUtils";

// add a test for parseAirTime in airTime.test.ts. airdate of "2025-07-05T00:00:00Z" and broadcast of "Saturdays at 00:00 (JST)" should become 2025-07-04 at 10am est
describe('AirTime', () => {
  test('parseAirTime correctly converts JST to local time', () => {
    const airDate = "2025-07-05T00:00:00Z";
    const broadcast = "Saturdays at 00:00 (JST)";
    const expectedLocalDate = new Date("2025-07-04T10:00:00-04:00"); // 10am EST on July 4, 2025

    const parsedDate = parseAirTime(airDate, broadcast);
    expect(parsedDate).toEqual(expectedLocalDate);
  });
});
