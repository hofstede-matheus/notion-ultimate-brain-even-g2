@glasses @tasks
Feature: Task details

  A task in a list shows only its name. "Load metadata" fetches the two other things worth knowing
  at a glance: which project it is filed under, and when it is due.

  Background:
    Given I have opened a task's action menu

  Scenario: Loading the details
    When I tap "Load metadata"
    Then the glasses show:
      """
      TASK DETAILS

      Loading…

      Double-tap to go back.
      """
    And a spinner turns in the header

  Scenario: A task with both a project and a due date
    Given the task is filed under "Kitchen" and due on 2026-07-04
    When I tap "Load metadata"
    Then the glasses show:
      """
      TASK DETAILS

      Project: Kitchen
      Due: Jul 4, 2026

      Double-tap to go back.
      """

  Scenario: A task with neither
    Given the task is filed nowhere and has no due date
    When I tap "Load metadata"
    Then the glasses show:
      """
      TASK DETAILS

      Project: (none)
      Due: (none)

      Double-tap to go back.
      """

  Scenario Outline: Due dates are written out in full
    Given the task is due on <date>
    When I load its details
    Then the glasses show "Due: <shown>"

    Examples:
      | date       | shown        |
      | 2026-07-04 | Jul 4, 2026  |
      | 2026-12-25 | Dec 25, 2026 |
      | 2027-01-01 | Jan 1, 2027  |

  Scenario: Only the first project is shown
    Given the task is filed under more than one project
    When I load its details
    Then the glasses show the first of them

  Scenario: Details that cannot be loaded say why
    Given the details cannot be loaded
    When I tap "Load metadata"
    Then the glasses show what went wrong instead of the project and due lines
    And below it "Double-tap to go back."

  Scenario: A long message is shortened
    Given the details fail with a message wider than the display
    When I tap "Load metadata"
    Then it is shortened to one line

  Scenario: A long project name is shortened
    Given the task is filed under a project whose name is wider than the display
    When I load its details
    Then the line still begins "Project: "
    And the name is shortened to fit

  Scenario: Returning to the action menu
    Given I am viewing "TASK DETAILS"
    When I double-tap
    Then the task's action menu reopens

  Scenario: There is nothing to choose here
    Given I am viewing "TASK DETAILS"
    When I tap
    Then nothing happens
    When I swipe down
    Then nothing happens
