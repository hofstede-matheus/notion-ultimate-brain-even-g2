@glasses @tasks
Feature: Reading a task's page

  "Open page" reads whatever is written against the task, a screenful at a time.

  What the content itself looks like once it reaches the glasses is described separately, since it
  is the same for anything read this way.

  Background:
    Given I have opened a task's action menu

  Scenario: Opening it
    When I tap "Open page"
    Then the header shows the task's name
    And below it, "Loading…"
    And a spinner turns in the header
    When the page arrives
    Then its first screenful is shown under that same header

  Scenario: A task whose text is in its description
    Given a task with nothing written in the page itself
    And a description that does have text
    When I open its page
    Then the description is what I read
    # Most tasks in this workspace keep their text in the description rather than in the page,
    # so this is the common case rather than the rare one.

  Scenario: A task with nothing written anywhere
    Given a task with nothing in the page and no description
    When I open its page
    Then the header shows its name
    And below it, "This page is empty."
    And below that, "Double-tap to go back."

  Scenario: A page that cannot be loaded says why
    Given the page cannot be loaded
    When I open it
    Then the glasses show what went wrong
    And below it "Double-tap to go back."

  Scenario: A page that fits one screenful shows no page number
    Given a page that fits one screenful
    When I open it
    Then the header shows only the task's name

  Scenario: A longer page counts its screenfuls
    Given a page filling 4 screenfuls
    When I open it
    Then the header shows the task's name and "1/4"

  Scenario: Turning through it
    Given I am reading a page of 4 screenfuls
    When I tap
    Then the header shows "2/4"
    When I swipe down
    Then the header shows "3/4"
    When I swipe up
    Then the header shows "2/4"

  Scenario: Reading stops at both ends
    Given I am reading a page of 4 screenfuls
    When I swipe up on the first screenful
    Then the header still shows "1/4"
    When I reach the last screenful and tap
    Then the header still shows "4/4"
    And it does not wrap around to the start

  Scenario: Nothing turns while it is still loading
    Given a page is still loading
    When I tap
    Then nothing advances

  Scenario: Leaving returns to the task's action menu
    When I double-tap
    Then that task's action menu reopens

  Scenario: A page Notion could not send in full says so at the end
    Given a page too long for Notion to send whole
    When I open it and reach the end
    Then the last screenful reads "Page truncated by Notion."

  Scenario: Opening something else while a page is still loading
    Given I opened a large page and it is still loading
    When I go back and open a different page
    Then the first one never appears
    And I keep reading the page I actually opened

  Scenario: A long task name is shortened in the header
    Given a task whose name is wider than the display
    When I open its page
    Then the name is shortened with a trailing "…"
