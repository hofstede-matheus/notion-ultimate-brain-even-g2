@glasses @tasks
Feature: Choosing a due date on the calendar

  A full month at a time, six weeks by seven days, with a way to page between months above and
  below it. Choosing a day hands off to a confirmation before anything changes.

  Picking a date is done in two steps: first a week, then a day within that week. Moving to an
  arbitrary day one square at a time would take dozens of swipes.

  Background:
    Given I have opened a task's action menu

  Rule: The calendar opens somewhere useful

    Scenario: A task that already has a due date opens on that date
      Given the task is due on 2026-07-04
      When I tap "Change due date"
      Then the glasses show "CHANGE DUE" above "JULY 2026"
      And the week containing the 4th is highlighted

    Scenario: A task with no due date opens on today
      Given the task has no due date
      And today is 2026-07-04
      When I tap "Change due date"
      Then the glasses show "JULY 2026"
      And the week containing today is highlighted

    Scenario: The calendar always shows six full weeks
      When I open the calendar on any month
      Then six weeks are shown
      And days from the months either side fill the gaps
      And those days are drawn faded so they are easy to tell apart

    Scenario: Today and the current due date are marked
      Given the task is due on 2026-07-04 and today is 2026-07-01
      When I open the calendar
      Then the 1st is outlined as today
      And the 4th carries a small mark in its corner

  Rule: The first step chooses a week

    Scenario: The highlighted week
      Given the calendar is open
      Then the highlighted week is outlined
      And the bottom of the screen reads "Swipe: week · Tap: enter · 2x: back"

    Scenario: Moving between weeks
      Given the third week is highlighted
      When I swipe down
      Then the fourth week is highlighted
      When I swipe up
      Then the third week is highlighted again

    Scenario: Above the first week is the way to the previous month
      Given the first week is highlighted
      When I swipe up
      Then "PREV MONTH" is highlighted
      When I swipe up again
      Then it stays highlighted

    Scenario: Below the last week is the way to the next month
      Given the sixth week is highlighted
      When I swipe down
      Then "NEXT MONTH" is highlighted
      When I swipe down again
      Then it stays highlighted

    Scenario: Paging back a month
      Given the calendar shows "JULY 2026"
      And "PREV MONTH" is highlighted
      When I tap
      Then the calendar shows "JUNE 2026"

    Scenario: Paging forward a month
      Given the calendar shows "JULY 2026"
      And "NEXT MONTH" is highlighted
      When I tap
      Then the calendar shows "AUGUST 2026"

    Scenario: Paging across a year
      Given the calendar shows "DECEMBER 2026"
      And "NEXT MONTH" is highlighted
      When I tap
      Then the calendar shows "JANUARY 2027"

    Scenario: Leaving the calendar
      Given a week is highlighted
      When I double-tap
      Then the task's action menu reopens

  Rule: The second step chooses a day

    Scenario: Entering a week
      Given the week of 2026-07-05 to 2026-07-11 is highlighted
      When I tap
      Then the first day of that week belonging to July is highlighted
      And the bottom of the screen reads "Swipe: day · Tap: save · 2x: back"

    Scenario: Moving between days
      Given Monday of the highlighted week is selected
      When I swipe down
      Then Tuesday is selected
      When I swipe up
      Then Monday is selected again

    Scenario: Days from a neighbouring month are skipped
      Given the highlighted week begins with three days from the previous month
      And the first day belonging to this month is selected
      When I swipe up
      Then the selection stays where it is
      # Picking a date in a month I cannot see would be surprising — paging to that month
      # first is the way there.

    Scenario: Stopping at the end of the week
      Given the last day of the highlighted week is selected
      When I swipe down
      Then the selection stays where it is

    Scenario: Tapping a day asks me to confirm it
      Given a day is selected
      When I tap
      Then the glasses show the header "RESCHEDULE?"

    Scenario: Stepping back out to choosing a week
      Given a day is selected
      When I double-tap
      Then the whole week is highlighted again
      And the calendar stays open

  Rule: The calendar survives being set aside

    Scenario: Coming back to the calendar
      Given the calendar was open when I left the app
      When I come back to it
      Then the whole month is shown again, with nothing missing
      And the week or day I was on is still selected

  @known-gap
  Scenario: A due date can be changed but never removed
    Given a task that already has a due date
    When I open the calendar
    Then every choice sets a date
    And there is no way to take the due date off the task
