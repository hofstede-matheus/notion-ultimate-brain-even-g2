@glasses @projects
Feature: Opening a project

  A project cannot be changed from the glasses — it is a way in, not a destination. Opening one
  offers the only two things worth looking at: what is left to do, and what has been written down.

  Background:
    Given a project in any of the project lists

  Scenario: Opening a project
    When I tap it
    Then the glasses show the project's name as the header
    And the choices are "Tasks" and "Notes"

  Scenario: Going to its tasks
    Given I have opened a project
    When I tap "Tasks"
    Then the header is the project's name followed by " — TASKS"

  Scenario: Going to its notes
    Given I have opened a project
    When I tap "Notes"
    Then the header is the project's name followed by " — NOTES"

  Scenario: A project opened from any list returns to that list
    Given I opened a project from one of the project lists
    When I double-tap
    Then that list reopens
