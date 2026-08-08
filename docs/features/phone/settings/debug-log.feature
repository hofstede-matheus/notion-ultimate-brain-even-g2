@phone @diagnostics
Feature: The debug log

  The glasses cannot show why something went wrong — a list that will not load just looks empty.
  The debug log is where the actual reason is, and it is what a bug report is made from.

  It sits at the bottom of the settings page, and there is no other way to reach it.

  Background:
    Given the settings form is open

  Scenario: Finding the log
    Then the phone shows "Debug log" followed by how many lines it holds
    And a "Clear" button
    And a "Copy log" button
    And a scrollable panel of lines

  Scenario: Lines appear as the app is used
    When I open a view on the glasses
    Then a line about it appears in the log
    And the panel scrolls so the newest line stays in view

  Scenario Outline: Lines are coloured by what they are
    Given a <kind> line
    Then it is shown in <colour>

    Examples:
      | kind                | colour |
      | error               | red    |
      | warning             | yellow |
      | request or response | green  |
      | fine detail         | dim    |
      | anything else       | plain  |

  Scenario: A failed request reads as an error
    Given a request that failed
    Then its line is shown as an error rather than as an ordinary request

  Scenario: The previous session is kept and marked
    Given the app was closed and reopened
    Then the panel shows the previous session's lines above this one
    And a "── previous session ──" divider separates them

  Scenario: Copying the log
    When I tap "Copy log"
    Then the clipboard receives a heading naming the app version and the phone
    And how many lines there are, including how many came from last time
    And every line, with the same divider
    And the button reads "Copied ✓" for a moment

  Scenario: Copying does not work
    Given the phone will not let the app copy
    When I tap "Copy log"
    Then the button reads "Copy failed" for a moment
    And then goes back to "Copy log"

  Scenario: Clearing the log
    When I tap "Clear"
    Then the panel empties
    And the previous session goes with it
    And there is no confirmation and no undo

  Rule: Nothing secret reaches the log

    Scenario: My Notion token never appears
      Given the app is set up with a Notion token
      Then no line in the panel contains it
      And this is true of what I see, not just of what gets copied
      # The panel is meant to be screenshotted for a bug report.

    Scenario: Anything that looks like a token is hidden
      Given a line would have contained something shaped like a Notion token
      Then it is shown as "***REDACTED***" instead

    Scenario: Long unreadable values are summarised
      Given a line would have contained a very long unreadable value
      Then it is replaced with a note of how long it was

  Rule: The log survives a crash

    Scenario: An error is kept even if the app dies straight after
      Given an error is logged
      When the app closes unexpectedly
      Then that error is still in the log when the app reopens

    Scenario: Closing the app keeps what was logged
      When I close the app
      Then what was logged appears as the previous session next time
