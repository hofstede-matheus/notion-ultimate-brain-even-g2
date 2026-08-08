@glasses @notes
Feature: Note details

  A note's only detail worth a screen is which project it is filed under. There is no due date
  line here — a note never has one.

  Background:
    Given I have opened a note's action menu

  Scenario: Loading the details
    When I tap "Load metadata"
    Then the glasses show:
      """
      NOTE DETAILS

      Loading…

      Double-tap to go back.
      """
    And a spinner cycles in the header

  Scenario: A note filed under a project
    Given the note is filed under "Website"
    When I tap "Load metadata"
    Then the glasses show:
      """
      NOTE DETAILS

      Project: Website

      Double-tap to go back.
      """

  Scenario: A note with no project
    Given the note is filed nowhere
    When I tap "Load metadata"
    Then the glasses show:
      """
      NOTE DETAILS

      Project: (none)

      Double-tap to go back.
      """

  Scenario: There is never a due line
    Given the note is filed under a project
    When I load its details
    Then no "Due:" line is shown

  Scenario: Details that cannot be loaded say why
    Given the details cannot be loaded
    When I tap "Load metadata"
    Then the glasses show what went wrong instead of the project line
    And below it "Double-tap to go back."

  Scenario: A long message is shortened
    Given the details fail with a message wider than the display
    When I tap "Load metadata"
    Then it is shortened to one line

  Scenario: A long project name is shortened
    Given the note is filed under a project whose name is wider than the display
    When I load its details
    Then the line still begins "Project: "
    And the name is shortened to fit

  Scenario: Returning to the action menu
    Given I am viewing "NOTE DETAILS"
    When I double-tap
    Then the note's action menu reopens

  Scenario: There is nothing to choose here
    Given I am viewing "NOTE DETAILS"
    When I tap
    Then nothing happens
    When I swipe down
    Then nothing happens
