@phone @tasks
Feature: Tasks waiting to be sent

  A task dictated on the glasses is saved on the phone first and sent to Notion straight
  after. When there is no connection the sending part waits, and the phone is where I can
  see that it is waiting.

  The card only appears when something is actually waiting. Most of the time there is
  nothing to say, so nothing is said.

  Sending happens on its own — when the app comes back to the front, and whenever anything
  else it asks for succeeds. The button is there for when I do not want to wait for that.

  Background:
    Given I have the app open on my phone

  Rule: Seeing what is waiting

    Scenario: Nothing is waiting
      Given no tasks are waiting to be sent
      Then I see nothing about tasks waiting

    Scenario: One task is waiting
      Given I dictated "buy oat milk" while there was no connection
      Then the phone shows "1 pending task"
      And I see "buy oat milk"
      And it is marked as waiting

    Scenario: Several tasks are waiting
      Given two tasks are waiting to be sent
      Then the phone shows "2 pending tasks"

    Scenario: A task that has been tried and failed
      Given "buy oat milk" has been tried twice without getting through
      Then it shows how many attempts have been made

    Scenario: A task that has been given up on
      Given "buy oat milk" has been tried five times without getting through
      Then it shows "failed after 5 tries"
      And the phone shows how many have failed alongside the total

  Rule: Getting them sent

    Scenario: They send themselves once there is a connection
      Given "buy oat milk" is waiting to be sent
      When the connection comes back
      Then it is sent
      And it is no longer waiting

    Scenario: Sending them myself
      Given "buy oat milk" is waiting to be sent
      When I tap "Sync now"
      Then it is sent
      And it is no longer waiting

    Scenario: The oldest goes first
      Given I dictated "buy oat milk" and then "call the dentist" with no connection
      When they are sent
      Then "buy oat milk" is sent before "call the dentist"

    Scenario: Sending is not offered when everything has been given up on
      Given every waiting task has been given up on
      Then I cannot tap "Sync now"

  Rule: Getting rid of them

    Scenario: Dropping one
      Given "buy oat milk" and "call the dentist" are waiting
      When I tap "Discard" next to "buy oat milk"
      Then only "call the dentist" is left

    Scenario: Dropping all of them
      Given two tasks are waiting
      When I tap "Clear"
      Then nothing is waiting
      And I see nothing about tasks waiting

  Rule: They survive being left alone

    Scenario: Coming back later
      Given "buy oat milk" is waiting to be sent
      When I close the app and open it again
      Then "buy oat milk" is still waiting
