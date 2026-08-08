@glasses @tasks
Feature: Adding a task by voice

  The one place the glasses create something rather than act on something that already exists.
  Speech is recognised on the device itself, so nothing that is said leaves the glasses.

  Recording stops by itself once talking stops, so the whole thing is: tap, speak, check what it
  heard, tap again.

  Background:
    Given I am on the "TASKS" menu
    And the app is ready to listen

  Rule: The usual path

    Scenario: The screen invites a recording
      When I tap "Add Task (Voice)"
      Then the glasses show:
        """
        ADD TASK

        Tap to start recording.

        Speak your task — stops
        automatically on silence.

        Double-tap to go back.
        """

    Scenario: Recording
      Given I am on the Add Task screen
      When I tap
      Then the glasses start listening
      And the glasses show:
        """
        ADD TASK

        >>> RECORDING <<<

        Speak your task now...

        Stops on silence.
        Tap to stop early.
        """

    Scenario: Recording stops once I stop talking
      Given I am recording and have said something
      When I stay quiet for a moment
      Then the glasses stop listening
      And the glasses show:
        """
        ADD TASK

        Processing audio...
        Please wait.
        """

    Scenario: Checking what it heard
      Given I said "buy oat milk"
      When it finishes working out what I said
      Then the glasses show:
        """
        ADD TASK

        Confirm task:
        "buy oat milk"

        Tap to confirm.
        Double-tap to discard
        & re-record.
        """

    Scenario: Creating the task
      Given "buy oat milk" is waiting to be confirmed
      When I tap
      Then the glasses show "Saving task..." with a spinner in the header
      When the task is created
      Then the glasses show:
        """
        ADD TASK

        Task created!

        "buy oat milk"

        Tap to add another.
        Double-tap to go back.
        """

    Scenario: Adding another straight away
      Given a task was just created
      When I tap
      Then recording starts again

    Scenario: Finishing
      Given a task was just created
      When I double-tap
      Then the glasses show the header "TASKS"

  Rule: Recording can be stopped or abandoned

    Scenario: Stopping early
      Given I am recording
      When I tap
      Then the glasses stop listening
      And show "Processing audio..."

    Scenario: Recording stops after fifteen seconds regardless
      Given I am recording and never stop talking
      When 15 seconds pass
      Then the glasses stop listening and work out what I said

    Scenario: Discarding a transcript and starting over
      Given "buy oat milk" is waiting to be confirmed
      When I double-tap
      Then it is discarded
      And the glasses are ready to record again
      And I have not left the screen

    Scenario: Backing out mid-recording
      Given I am recording
      When I double-tap
      Then the glasses stop listening
      And show the header "TASKS"
      And nothing appears afterwards from what I had said

    Scenario: Leaving the app stops the recording
      Given I am recording
      When I leave the app
      Then the glasses stop listening

    Scenario: Closing the app stops the recording
      Given I am recording
      When the app closes
      Then the glasses stop listening

    Scenario: Taps are ignored while it is working
      Given the glasses show "Processing audio..."
      When I tap
      Then nothing happens

    Scenario: Taps are ignored while the task is being created
      Given the glasses show "Saving task..."
      When I tap
      Then nothing happens

  Rule: Failures explain themselves and can be retried

    Scenario: Not ready to listen yet
      Given the app is not yet ready to listen
      When I tap to start recording
      Then the glasses show:
        """
        ADD TASK

        Error:
        Voice model loading. Please try again in a moment.

        Tap to try again.
        Double-tap to go back.
        """
      When I wait a moment and tap again
      Then recording starts

    Scenario: Nothing was heard
      Given I tapped to record and said nothing
      When it finishes listening
      Then the glasses show:
        """
        ADD TASK

        Error:
        Couldn't hear anything. Tap to try again.

        Tap to try again.
        Double-tap to go back.
        """

    Scenario: The task could not be created
      Given "buy oat milk" is waiting to be confirmed
      And it will not save
      When I tap to confirm
      Then the glasses show "Error:" and what went wrong
      And what I said is discarded
      When I tap
      Then recording starts from scratch
      # A failed save means saying it again — the words are not kept.

    Scenario: Leaving after an error
      Given an error is showing
      When I double-tap
      Then the glasses show the header "TASKS"

  Rule: Nothing carries over between visits

    Scenario: Reopening the screen clears the last attempt
      Given I created a task earlier
      When I leave and open "Add Task (Voice)" again
      Then the glasses are ready to record
      And nothing from the earlier attempt is showing

    Scenario: Swiping does nothing here
      Given I am on the Add Task screen
      When I swipe down
      Then nothing happens
