@glasses @tasks
Feature: Saving a new due date

  Choosing a day on the calendar does not move the task on its own — the new date is confirmed
  first, then acknowledged before the list comes back.

  Background:
    Given I have opened the calendar for a task and selected a day

  Scenario: Confirming
    Given 2026-07-04 is selected
    When I tap
    Then the glasses show the header "RESCHEDULE?"
    And the choices are "To Jul 4, 2026" and "Cancel"
    When I tap "To Jul 4, 2026"
    Then the glasses show:
      """
      MOVED

      ✓ Jul 4, 2026

      Returning...
      """
    And after 1.5 seconds the list the task came from reopens

  Scenario: The date is written out in full
    Given 2026-12-25 is selected
    When I tap
    Then the choice reads "To Dec 25, 2026"

  Scenario: Cancelling
    When I tap "Cancel"
    Then the due date is unchanged
    And the list the task came from reopens

  Scenario: Cancelling by double-tapping
    When I double-tap
    Then the due date is unchanged
    And the list the task came from reopens

  Scenario: A reschedule that fails can be tried again
    Given the change will not save
    When I confirm a new due date
    Then the header shows "FAILED: " followed by what went wrong
    And the two choices are unchanged
    And the task keeps its old due date

  Scenario: The task moves between the date-based lists at once
    Given an overdue task, due yesterday
    When I reschedule it to today
    Then it is in "TODAY'S TASKS"
    And it is no longer in "OVERDUE"
    And neither list had to reload
