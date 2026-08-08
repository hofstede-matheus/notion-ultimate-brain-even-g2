@glasses @notes
Feature: Note details

  A note's row in a list is shortened to fit, so a long title can only be read in part. "Note
  Details" shows the title in full, along with the one other thing worth knowing: which project
  it is filed under. There is no due date line here — a note never has one.

  It is laid out exactly like a task's details, minus that line: each thing is labelled on its own
  line, with the value below it.

  Background:
    Given I have opened a note's action menu

  Scenario: Loading the details
    When I tap "Note Details"
    Then the glasses show:
      """
      NOTE DETAILS

      Loading…

      Double-tap to go back.
      """
    And a spinner cycles in the header

  Scenario: A note filed under a project
    Given the note is named "Meeting recap" and filed under "Website"
    When I tap "Note Details"
    Then the glasses show:
      """
      NOTE DETAILS

      Note:
      Meeting recap

      Project:
      Website

      Double-tap to go back.
      """

  Scenario: A note with no project
    Given the note is filed nowhere
    When I tap "Note Details"
    Then the glasses show "(none)" under "Project:"
    And the note's title is still shown in full

  Scenario: There is never a due line
    Given the note is filed under a project
    When I load its details
    Then no "Due:" line is shown

  Scenario: The title is shown in full, however long it is
    Given a note whose title is too long to fit a row in a list
    When I load its details
    Then the whole title is shown, with nothing cut off and no "…"
    And it wraps onto as many lines as it needs

  Scenario: Details longer than the screen can be scrolled
    Given a note whose title and project together run past the bottom of the display
    When I load its details
    Then swiping moves through the rest of them
    And double-tapping still returns to the action menu

  Scenario: Details that cannot be loaded say why
    Given the details cannot be loaded
    When I tap "Note Details"
    Then the glasses show what went wrong instead of the note and project lines
    And below it "Double-tap to go back."

  Scenario: A long message is shortened
    Given the details fail with a message wider than the display
    When I tap "Note Details"
    Then it is shortened to one line

  Scenario: Returning to the action menu
    Given I am viewing "NOTE DETAILS"
    When I double-tap
    Then the note's action menu reopens

  Scenario: There is nothing to choose here
    Given I am viewing "NOTE DETAILS"
    When I tap
    Then nothing happens
