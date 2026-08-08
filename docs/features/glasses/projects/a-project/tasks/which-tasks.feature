@glasses @projects
Feature: Choosing which of a project's tasks to see

  A project's tasks are split into what is still open and what is finished, so the two never crowd
  each other out.

  Background:
    Given I have opened a project

  Scenario: The choice
    When I tap "Tasks"
    Then the header is the project's name followed by " — TASKS"
    And the choices are "To Do" and "Done"
    And there is nothing to wait for

  Scenario: Going to the open tasks
    Given I am on a project's tasks menu
    When I tap "To Do"
    Then the header is the project's name followed by " — TO DO"

  Scenario: Going to the finished tasks
    Given I am on a project's tasks menu
    When I tap "Done"
    Then the header is the project's name followed by " — DONE"

  Scenario: Going back to the project
    Given I am on a project's tasks menu
    When I double-tap
    Then the project itself reopens
