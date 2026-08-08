@glasses @projects
Feature: A project's task lists

  Two lists behind the same choice: what is still open, and what is finished. A checkbox on every
  row keeps them apart at a glance even after drilling in.

  Anything found here behaves exactly as it would in a top-level task list.

  Scenario: The open tasks
    Given I am viewing a project's open tasks
    Then the header is the project's name followed by " — TO DO"
    And each task row begins "[ ] "

  Scenario: The finished tasks
    Given I am viewing a project's finished tasks
    Then the header is the project's name followed by " — DONE"
    And each task row begins "[v] "

  Scenario Outline: Each says what empty means
    Given a project with no <kind> tasks
    When I open them
    Then the glasses show "<empty message>"

    Examples:
      | kind     | empty message                   |
      | open     | No to-do tasks in this project. |
      | finished | No done tasks in this project.  |

  Scenario: Tapping a task opens the full task menu
    Given I am viewing a project's open tasks
    When I tap one
    Then the glasses show that task's name as the header
    And all six task choices are listed

  Scenario: Going back to the choice between open and finished
    Given I am viewing a project's open tasks
    When I double-tap
    Then the choice between "To Do" and "Done" reopens

  Scenario: Each project remembers its own tasks
    Given I viewed one project's open tasks earlier
    When I open a different project's open tasks
    Then the first project's tasks are never shown, not even for a moment
    And reopening the first project brings its own tasks straight back
