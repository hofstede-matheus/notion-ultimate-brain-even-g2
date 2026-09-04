@glasses @tasks
Feature: Task details

  A task's row in a list is shortened to fit, so a long name can only be read in part. "Task
  Details" shows the name in full, along with the two other things worth knowing at a glance:
  which project it is filed under, and when it is due.

  Each of the three is labelled on its own line, with the value below it — a name that would not
  fit beside its label still gets the full width of the display.

  Background:
    Given I have opened a task's contextual menu

  Scenario: Loading the details
    When I choose "Task Details"
    Then the glasses show:
      """
      TASK DETAILS

      Loading…

      Double-tap to go back.
      """
    And a spinner turns in the header

  Scenario: A task with both a project and a due date
    Given the task is named "Buy milk", filed under "Kitchen" and due on 2026-07-04
    When I choose "Task Details"
    Then the glasses show:
      """
      TASK DETAILS

      Task:
      Buy milk

      Project:
      Kitchen

      Due:
      Jul 4, 2026

      Double-tap to go back.
      """

  Scenario: A task with neither
    Given the task is filed nowhere and has no due date
    When I choose "Task Details"
    Then the glasses show "(none)" under both "Project:" and "Due:"
    And the task's name is still shown in full

  Scenario: The name is shown in full, however long it is
    Given a task whose name is too long to fit a row in a list
    When I load its details
    Then the whole name is shown, with nothing cut off and no "…"
    And it wraps onto as many lines as it needs

  Scenario: Details longer than the screen can be scrolled
    Given a task whose name and project together run past the bottom of the display
    When I load its details
    Then swiping moves through the rest of them
    And double-tapping still returns to the list the task came from

  Scenario Outline: Due dates are written out in full
    Given the task is due on <date>
    When I load its details
    Then the glasses show "<shown>" under "Due:"

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
    When I choose "Task Details"
    Then the glasses show what went wrong instead of the task, project and due lines
    And below it "Double-tap to go back."

  Scenario: A long message is shortened
    Given the details fail with a message wider than the display
    When I choose "Task Details"
    Then it is shortened to one line

  Scenario: Returning to the list
    Given I am viewing "TASK DETAILS"
    When I double-tap
    Then the list the task came from reopens

  Scenario: There is nothing to choose here
    Given I am viewing "TASK DETAILS"
    When I tap
    Then nothing happens
